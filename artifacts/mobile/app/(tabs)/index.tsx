import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import FileItem from "@/components/FileItem";

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { files, currentFile, createFile, deleteFile, openFile, updateFileContent } =
    useIDE();
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const fileList = Object.values(files).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  async function handleOpen(path: string) {
    await openFile(path);
    router.navigate("/(tabs)/editor");
  }

  async function handleDelete(path: string) {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      "Delete File",
      `Delete "${path}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteFile(path),
        },
      ]
    );
  }

  async function handleCreate() {
    const name = newFileName.trim();
    if (!name) return;
    if (files[name]) {
      Alert.alert("File exists", `"${name}" already exists.`);
      return;
    }
    await createFile(name);
    setShowNewFile(false);
    setNewFileName("");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.navigate("/(tabs)/editor");
  }

  async function handleImport() {
    if (isWeb) {
      Alert.alert(
        "Import",
        "File import is available on iOS and Android. Use the + button to create files manually."
      );
      return;
    }
    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) return;

      let imported = 0;
      for (const asset of result.assets) {
        const fileName = asset.name;
        try {
          const content = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          if (files[fileName]) {
            await new Promise<void>((resolve) => {
              Alert.alert(
                "File exists",
                `"${fileName}" already exists. Overwrite?`,
                [
                  { text: "Skip", style: "cancel", onPress: () => resolve() },
                  {
                    text: "Overwrite",
                    style: "destructive",
                    onPress: async () => {
                      await updateFileContent(fileName, content);
                      imported++;
                      resolve();
                    },
                  },
                ]
              );
            });
          } else {
            await createFile(fileName);
            await updateFileContent(fileName, content);
            imported++;
          }
        } catch {
          Alert.alert("Import error", `Could not read "${fileName}". Only text files are supported.`);
        }
      }

      if (imported > 0) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const lastImported = result.assets[result.assets.length - 1];
        if (lastImported) {
          await openFile(lastImported.name);
          router.navigate("/(tabs)/editor");
        }
      }
    } catch {
      // user cancelled or permission denied
    } finally {
      setImporting(false);
    }
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
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Explorer
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {fileList.length} file{fileList.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {/* Import button */}
          <TouchableOpacity
            onPress={handleImport}
            disabled={importing}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                opacity: importing ? 0.5 : 1,
              },
            ]}
            activeOpacity={0.75}
          >
            <Feather name="upload" size={16} color={colors.foreground} />
          </TouchableOpacity>
          {/* New file button */}
          <TouchableOpacity
            onPress={() => {
              setShowNewFile(true);
              setNewFileName("");
            }}
            style={[styles.iconBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: isWeb ? 34 + 84 : insets.bottom + 84,
        }}
        showsVerticalScrollIndicator={false}
      >
        {fileList.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="folder" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No files yet
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Tap + to create or the upload icon to import
            </Text>
          </View>
        ) : (
          fileList.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              isActive={currentFile?.path === file.path}
              onPress={() => handleOpen(file.path)}
              onDelete={() => handleDelete(file.path)}
            />
          ))
        )}
      </ScrollView>

      {/* New file modal */}
      <Modal
        visible={showNewFile}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewFile(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowNewFile(false)}
          />
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              New File
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                },
              ]}
              placeholder="filename.ts"
              placeholderTextColor={colors.mutedForeground}
              value={newFileName}
              onChangeText={setNewFileName}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
              .ts  .js  .py  .md  .css  .json  .yaml  .html
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowNewFile(false)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerSub: { fontSize: 12, marginTop: 2 },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  list: { flex: 1 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyText: { fontSize: 17, fontWeight: "600", marginTop: 12 },
  emptyHint: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: {
    width: "88%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalHint: { fontSize: 12, marginTop: -4, letterSpacing: 0.5 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalBtnPrimary: { borderWidth: 0 },
});
