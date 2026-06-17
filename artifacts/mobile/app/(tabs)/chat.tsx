import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
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

const SUGGESTIONS = [
  { icon: "search" as const, text: "Explain this code" },
  { icon: "zap" as const, text: "Find and fix bugs" },
  { icon: "edit-3" as const, text: "Refactor for clarity" },
  { icon: "check-square" as const, text: "Write unit tests" },
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentFile, apiKey } = useIDE();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const abortRef = useRef<boolean>(false);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 76 : insets.bottom;

  function buildSystemPrompt(): string {
    if (!currentFile) {
      return "You are an expert coding assistant. Help the user with coding questions, explain concepts, suggest improvements, and write code. Use markdown and code blocks. Be concise and practical.";
    }
    return `You are an expert coding assistant. The user has this file open:

**${currentFile.name}** (${currentFile.language})

\`\`\`${currentFile.language}
${currentFile.content.slice(0, 6000)}${currentFile.content.length > 6000 ? "\n// ... (truncated)" : ""}
\`\`\`

Help them understand, improve, or extend this code. Be concise and practical. Use markdown.`;
  }

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || isLoading) return;

      if (!apiKey.trim()) {
        const helpMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "## API Key Required\n\nTo use the AI assistant, add your **Anthropic API key** in the Settings tab.\n\n1. Go to **Settings** (gear icon)\n2. Paste your key in **AI Configuration**\n3. Tap **Save Key**\n\nGet a free key at [console.anthropic.com](https://console.anthropic.com)",
        };
        setMessages((prev) => [helpMsg, ...prev]);
        return;
      }

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageText,
      };

      const loadingId = (Date.now() + 1).toString();
      const loadingMsg: Message = {
        id: loadingId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [loadingMsg, userMsg, ...prev]);
      setInput("");
      setIsLoading(true);
      abortRef.current = false;

      // Build conversation history (send oldest first)
      const history = messages
        .slice()
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user" as const, content: messageText });

      try {
        const controller = new AbortController();

        const response = await fetch(`${getBaseUrl()}/api/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-anthropic-key": apiKey.trim(),
          },
          body: JSON.stringify({
            messages: history,
            systemPrompt: buildSystemPrompt(),
          }),
          signal: controller.signal,
        });

        if (abortRef.current) {
          controller.abort();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? { ...m, content: "_Cancelled._", isStreaming: false }
                : m
            )
          );
          return;
        }

        const data = (await response.json()) as {
          content?: string;
          error?: string;
        };

        if (!response.ok || data.error) {
          throw new Error(data.error ?? `Server error ${response.status}`);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, content: data.content ?? "(no response)", isStreaming: false }
              : m
          )
        );
      } catch (err: any) {
        if (abortRef.current) return;
        const errText =
          err?.name === "AbortError"
            ? "_Cancelled._"
            : err?.message?.includes("401") || err?.message?.includes("Invalid API")
            ? "❌ **Invalid API key** — please check your key in Settings."
            : err?.message?.includes("429")
            ? "⏳ **Rate limited** — wait a moment and try again."
            : err?.message?.includes("fetch") || err?.message?.includes("network") || err?.message?.includes("Failed")
            ? "🔌 **Connection error** — make sure the server is running."
            : `❌ Error: ${err?.message ?? "Unknown error"}`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, content: errText, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = false;
      }
    },
    [input, isLoading, messages, apiKey, currentFile]
  );

  function stopLoading() {
    abortRef.current = true;
    setIsLoading(false);
  }

  function clearChat() {
    stopLoading();
    setMessages([]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 10,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.modelBadge,
              {
                backgroundColor: colors.primary + "18",
                borderColor: colors.primary + "35",
              },
            ]}
          >
            <Text style={[styles.modelBadgeText, { color: colors.primary }]}>
              ✦ Claude
            </Text>
          </View>
          {currentFile && (
            <View
              style={[
                styles.contextPill,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="file-text" size={11} color={colors.mutedForeground} />
              <Text
                style={[styles.contextPillText, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {currentFile.name}
              </Text>
            </View>
          )}
        </View>

        {messages.length > 0 && (
          <TouchableOpacity
            onPress={clearChat}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="rotate-ccw" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            item.isStreaming && !item.content ? (
              <View style={styles.thinkingRow}>
                <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.thinkingText, { color: colors.mutedForeground }]}>
                    Claude is thinking…
                  </Text>
                </View>
              </View>
            ) : (
              <ChatMessage message={item} />
            )
          )}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          ListFooterComponent={
            messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyGlow,
                    { backgroundColor: colors.primary + "15" },
                  ]}
                >
                  <Text style={styles.emptyEmoji}>✦</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  AI Code Assistant
                </Text>
                <Text
                  style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
                >
                  {currentFile
                    ? `Ask about ${currentFile.name} or anything else`
                    : "Ask me to write, explain, or debug code"}
                </Text>

                <ScrollView
                  horizontal={false}
                  style={styles.suggestionList}
                  showsVerticalScrollIndicator={false}
                >
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s.text}
                      onPress={() => sendMessage(s.text)}
                      style={[
                        styles.suggestionChip,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Feather name={s.icon} size={15} color={colors.primary} />
                      <Text
                        style={[styles.suggestionText, { color: colors.foreground }]}
                      >
                        {s.text}
                      </Text>
                      <Feather
                        name="arrow-right"
                        size={13}
                        color={colors.mutedForeground}
                        style={{ marginLeft: "auto" }}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.card,
                borderColor: isLoading
                  ? colors.primary + "80"
                  : colors.border,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder={
                isLoading ? "Claude is thinking…" : "Ask about your code…"
              }
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!isLoading}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => sendMessage()}
            />
            <TouchableOpacity
              onPress={isLoading ? stopLoading : () => sendMessage()}
              disabled={!isLoading && !input.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: isLoading
                    ? "#ef4444"
                    : input.trim()
                    ? colors.primary
                    : colors.secondary,
                },
              ]}
              activeOpacity={0.8}
            >
              <Feather
                name={isLoading ? "square" : "arrow-up"}
                size={15}
                color={input.trim() || isLoading ? "#fff" : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Powered by Claude · Set key in Settings
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  modelBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  modelBadgeText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    maxWidth: 150,
  },
  contextPillText: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  messageList: {
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  thinkingRow: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "flex-start",
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  thinkingText: { fontSize: 14, fontStyle: "italic" },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    gap: 12,
  },
  emptyGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
  },
  suggestionList: { width: "100%", marginTop: 4 },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 8,
  },
  suggestionText: { fontSize: 14, fontWeight: "500", flex: 1 },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 18,
    borderWidth: 1.5,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  disclaimer: { fontSize: 11, textAlign: "center" },
});
