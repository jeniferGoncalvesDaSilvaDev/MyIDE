import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIDE } from "@/context/IDEContext";
import { useColors } from "@/hooks/useColors";
import SyntaxHighlighter, { MONO_FONT } from "@/components/SyntaxHighlighter";

const LANG_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  markdown: "Markdown",
  bash: "Shell",
  yaml: "YAML",
  text: "Plain Text",
};

const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  python: "#3776ab",
  css: "#264de4",
  html: "#e34c26",
  json: "#5c9eb0",
  markdown: "#083fa1",
  bash: "#4eaa25",
  yaml: "#cb171e",
  text: "#888888",
};

export default function EditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentFile, updateFileContent } = useIDE();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  function openEditor() {
    if (!currentFile) return;
    setEditContent(currentFile.content);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function saveFile() {
    if (!currentFile) return;
    await updateFileContent(currentFile.path, editContent);
    setEditing(false);
    setSaved(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setSaved(false), 2000);
  }

  function cancelEdit() {
    setEditing(false);
    setEditContent("");
  }

  const langLabel = currentFile
    ? LANG_LABELS[currentFile.language] ?? currentFile.language
    : "";
  const langColor = currentFile
    ? LANG_COLORS[currentFile.language] ?? "#888"
    : "#888";

  if (!currentFile) {
    return (
      <View
        style={[
          styles.container,
          styles.empty,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <Feather name="code" size={52} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No file open
        </Text>
        <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
          Open a file from the Files tab
        </Text>
      </View>
    );
  }

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
        <View style={styles.headerLeft}>
          <Text
            style={[styles.filename, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {currentFile.name}
          </Text>
          <View
            style={[
              styles.langBadge,
              { backgroundColor: langColor + "20" },
            ]}
          >
            <Text style={[styles.langBadgeText, { color: langColor }]}>
              {langLabel}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {saved && (
            <View style={styles.savedIndicator}>
              <Feather name="check" size={13} color={colors.primary} />
              <Text style={[styles.savedText, { color: colors.primary }]}>
                Saved
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={openEditor}
            style={[
              styles.editBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={14} color={colors.foreground} />
            <Text style={[styles.editBtnText, { color: colors.foreground }]}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.statusBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.statusItem}>
          <View
            style={[styles.statusDot, { backgroundColor: langColor }]}
          />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {langLabel}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {currentFile.content.split("\n").length} lines
        </Text>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {currentFile.content.length} chars
        </Text>
      </View>

      <ScrollView
        style={[styles.codeArea, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingBottom: isWeb ? 34 + 84 : insets.bottom + 84,
          paddingLeft: 4,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SyntaxHighlighter
          code={currentFile.content}
          language={currentFile.language}
          fontSize={13.5}
          showLineNumbers
        />
      </ScrollView>

      <Modal
        visible={editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cancelEdit}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.editModal,
              {
                backgroundColor: colors.background,
                paddingTop: isWeb ? 67 : insets.top + 12,
              },
            ]}
          >
            <View
              style={[
                styles.editHeader,
                {
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity onPress={cancelEdit} activeOpacity={0.7}>
                <Text style={[styles.cancelBtn, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.editTitle, { color: colors.foreground }]}>
                {currentFile.name}
              </Text>
              <TouchableOpacity onPress={saveFile} activeOpacity={0.8}>
                <Text style={[styles.saveBtn, { color: colors.primary }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              ref={inputRef}
              style={[
                styles.codeInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              scrollEnabled
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
    marginRight: 12,
  },
  filename: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
    fontFamily: MONO_FONT,
  },
  langBadge: {
    alignSelf: "flex-start",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  savedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontFamily: MONO_FONT,
  },
  codeArea: {
    flex: 1,
  },
  editModal: {
    flex: 1,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    fontSize: 16,
  },
  editTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: MONO_FONT,
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: "700",
  },
  codeInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13.5,
    lineHeight: 22,
    fontFamily: MONO_FONT,
  },
});
