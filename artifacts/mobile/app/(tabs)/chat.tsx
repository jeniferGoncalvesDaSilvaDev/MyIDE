import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatMessage, { Message } from "@/components/ChatMessage";
import { useIDE } from "@/context/IDEContext";
import { useColors } from "@/hooks/useColors";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentFile, apiKey } = useIDE();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom;

  function buildSystemPrompt(): string {
    if (!currentFile) {
      return "You are an expert coding assistant, similar to GitHub Copilot or Cursor AI. Help the user with coding questions, explain concepts, suggest improvements, and write code.";
    }
    return `You are an expert coding assistant, similar to GitHub Copilot or Cursor AI. The user currently has the following file open in their editor:

File: ${currentFile.name} (${currentFile.language})

\`\`\`${currentFile.language}
${currentFile.content}
\`\`\`

Help the user understand, improve, or extend this code. Be concise and practical. Use markdown code blocks for code snippets.`;
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      const noKeyMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Please add your Anthropic API key in the **Settings** tab to use the AI assistant.\n\nYou can get an API key at console.anthropic.com",
      };
      setMessages((prev) => [noKeyMsg, ...prev]);
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const streamingId = (Date.now() + 1).toString();
    const streamingMsg: Message = {
      id: streamingId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [streamingMsg, userMsg, ...prev]);
    setInput("");
    setIsLoading(true);

    const history = messages
      .slice()
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    history.push({ role: "user", content: text });

    let aborted = false;
    abortRef.current = () => { aborted = true; };

    try {
      const response = await fetch(`${getBaseUrl()}/api/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anthropic-key": apiKey,
        },
        body: JSON.stringify({
          messages: history,
          systemPrompt: buildSystemPrompt(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulated += parsed.content;
              const currentAcc = accumulated;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId
                    ? { ...m, content: currentAcc, isStreaming: true }
                    : m
                )
              );
            } else if (parsed.done || parsed.error) {
              break;
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (err: any) {
      const errMsg = err?.message?.includes("401")
        ? "Invalid API key. Check your key in Settings."
        : "Connection error. Make sure the server is running.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId
            ? { ...m, content: errMsg, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading, messages, apiKey, currentFile]);

  function clearChat() {
    setMessages([]);
    abortRef.current?.();
    setIsLoading(false);
  }

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            AI Chat
          </Text>
          {currentFile && (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)/editor")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.contextIndicator,
                  { color: colors.primary },
                ]}
                numberOfLines={1}
              >
                <Feather name="file" size={11} /> {currentFile.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {messages.length > 0 && (
          <TouchableOpacity
            onPress={clearChat}
            style={[
              styles.clearBtn,
              { borderColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatMessage message={item} />}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: 12,
            flexGrow: 1,
            justifyContent: "flex-end",
          }}
          ListFooterComponent={
            messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.primary + "15" },
                  ]}
                >
                  <Feather name="zap" size={28} color={colors.primary} />
                </View>
                <Text
                  style={[styles.emptyTitle, { color: colors.foreground }]}
                >
                  Ask me anything
                </Text>
                <Text
                  style={[styles.emptyHint, { color: colors.mutedForeground }]}
                >
                  I can help you understand code, fix bugs, add features, write
                  tests, and more.
                </Text>
                {currentFile && (
                  <View
                    style={[
                      styles.contextChip,
                      {
                        backgroundColor: colors.primary + "15",
                        borderColor: colors.primary + "30",
                      },
                    ]}
                  >
                    <Feather name="file-text" size={12} color={colors.primary} />
                    <Text
                      style={[styles.contextChipText, { color: colors.primary }]}
                    >
                      {currentFile.name} is loaded as context
                    </Text>
                  </View>
                )}
                <View style={styles.suggestions}>
                  {[
                    "Explain this code",
                    "How can I improve this?",
                    "Add error handling",
                    "Write unit tests",
                  ].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setInput(s)}
                      style={[
                        styles.suggestion,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: colors.foreground },
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                { color: colors.foreground },
              ]}
              placeholder="Ask about your code..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              onSubmitEditing={Platform.OS !== "web" ? undefined : sendMessage}
              returnKeyType={Platform.OS !== "web" ? "send" : "default"}
              onKeyPress={
                Platform.OS === "web"
                  ? undefined
                  : undefined
              }
            />
            <TouchableOpacity
              onPress={isLoading ? () => abortRef.current?.() : sendMessage}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: isLoading
                    ? colors.destructive
                    : input.trim()
                    ? colors.primary
                    : colors.secondary,
                },
              ]}
              activeOpacity={0.8}
            >
              <Feather
                name={isLoading ? "square" : "send"}
                size={16}
                color={input.trim() || isLoading ? "#fff" : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  contextIndicator: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyHint: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  contextChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 120,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
