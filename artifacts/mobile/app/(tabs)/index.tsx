import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import FileItem from "@/components/FileItem";
import type { FileNode } from "@/context/IDEContext";

// ── Tree types ─────────────────────────────────────────────────────────────

interface TreeFolder {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

interface TreeFile {
  type: "file";
  file: FileNode;
}

type TreeNode = TreeFolder | TreeFile;

function buildTree(files: Record<string, FileNode>): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeFolder>();

  function getOrCreateFolder(path: string): TreeFolder {
    if (folderMap.has(path)) return folderMap.get(path)!;
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const folder: TreeFolder = { type: "folder", name, path, children: [] };
    folderMap.set(path, folder);
    if (parts.length === 1) {
      root.push(folder);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      getOrCreateFolder(parentPath).children.push(folder);
    }
    return folder;
  }

  const sorted = Object.values(files).sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  for (const file of sorted) {
    const parts = file.path.split("/");
    if (parts.length === 1) {
      root.push({ type: "file", file });
    } else {
      const folderPath = parts.slice(0, -1).join("/");
      getOrCreateFolder(folderPath).children.push({ type: "file", file });
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      const na = a.type === "folder" ? a.name : a.file.name;
      const nb = b.type === "folder" ? b.name : b.file.name;
      return na.localeCompare(nb);
    });
    for (const n of nodes) if (n.type === "folder") sortNodes(n.children);
  }
  sortNodes(root);
  return root;
}

// ── FolderRow ───────────────────────────────────────────────────────────────

function FolderRow({
  folder,
  depth,
  isOpen,
  onToggle,
}: {
  folder: TreeFolder;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[
        styles.folderRow,
        { paddingLeft: 16 + depth * 20 },
      ]}
    >
      <Feather
        name={isOpen ? "chevron-down" : "chevron-right"}
        size={14}
        color={colors.mutedForeground}
        style={{ marginRight: 4 }}
      />
      <Feather
        name={isOpen ? "folder" : "folder"}
        size={16}
        color="#f2cc60"
        style={{ marginRight: 8 }}
      />
      <Text style={[styles.folderName, { color: colors.foreground }]}>
        {folder.name}
      </Text>
      <Text style={[styles.folderCount, { color: colors.mutedForeground }]}>
        {folder.children.length}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    files,
    currentFile,
    createFile,
    deleteFile,
    openFile,
    updateFileContent,
  } = useIDE();

  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    new Set(["src", "styles"])
  );
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(
    null
  );

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const tree = buildTree(files);
  const fileCount = Object.keys(files).length;

  function toggleFolder(path: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleOpen(path: string) {
    await openFile(path);
    router.navigate("/(tabs)/editor");
  }

  function requestDelete(path: string) {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setConfirmDeletePath(path);
  }

  async function confirmDelete() {
    if (!confirmDeletePath) return;
    await deleteFile(confirmDeletePath);
    setConfirmDeletePath(null);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleCreate() {
    const name = newFileName.trim();
    if (!name) return;
    if (files[name]) {
      setNewFileName("");
      return;
    }
    await createFile(name);
    setShowNewFile(false);
    setNewFileName("");

    // auto-open the folder it was placed in
    const parts = name.split("/");
    if (parts.length > 1) {
      setOpenFolders((prev) => new Set([...prev, parts.slice(0, -1).join("/")]));
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.navigate("/(tabs)/editor");
  }

  async function handleImport() {
    if (isWeb) return;
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
        try {
          const content = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          if (!files[asset.name]) {
            await createFile(asset.name);
          }
          await updateFileContent(asset.name, content);
          imported++;
        } catch {}
      }

      if (imported > 0) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const last = result.assets[result.assets.length - 1];
        if (last) {
          await openFile(last.name);
          router.navigate("/(tabs)/editor");
        }
      }
    } catch {} finally {
      setImporting(false);
    }
  }

  // Recursive tree renderer
  function renderNodes(nodes: TreeNode[], depth: number): React.ReactElement[] {
    const items: React.ReactElement[] = [];
    for (const node of nodes) {
      if (node.type === "folder") {
        const isOpen = openFolders.has(node.path);
        items.push(
          <FolderRow
            key={`folder:${node.path}`}
            folder={node}
            depth={depth}
            isOpen={isOpen}
            onToggle={() => toggleFolder(node.path)}
          />
        );
        if (isOpen) {
          items.push(...renderNodes(node.children, depth + 1));
        }
      } else {
        items.push(
          <FileItem
            key={`file:${node.file.path}`}
            file={node.file}
            depth={depth}
            isActive={currentFile?.path === node.file.path}
            onPress={() => handleOpen(node.file.path)}
            onDelete={() => requestDelete(node.file.path)}
          />
        );
      }
    }
    return items;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
            {fileCount} file{fileCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerButtons}>
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
            <Feather name="upload" size={15} color={colors.foreground} />
          </TouchableOpacity>
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

      {/* File tree */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: isWeb ? 34 + 84 : insets.bottom + 84,
        }}
        showsVerticalScrollIndicator={false}
      >
        {fileCount === 0 ? (
          <View style={styles.empty}>
            <Feather name="folder" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No files yet
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Tap + to create or ↑ to import
            </Text>
          </View>
        ) : (
          renderNodes(tree, 0)
        )}
      </ScrollView>

      {/* ── New file modal ── */}
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
              placeholder="main.ts  or  src/main.ts"
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
              Use / for folders — e.g. src/index.ts, components/Button.tsx
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

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={confirmDeletePath !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeletePath(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setConfirmDeletePath(null)}
          />
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.deleteIcon, { backgroundColor: "#ef444420" }]}>
              <Feather name="trash-2" size={24} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Delete File
            </Text>
            <Text style={[styles.deleteMsg, { color: colors.mutedForeground }]}>
              Delete{" "}
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                {confirmDeletePath}
              </Text>
              ? This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setConfirmDeletePath(null)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: "#ef4444" },
                ]}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  headerTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  list: { flex: 1 },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 16,
    marginHorizontal: 8,
  },
  folderName: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    letterSpacing: -0.1,
  },
  folderCount: { fontSize: 11, fontWeight: "500" },
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
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: {
    width: "88%",
    maxWidth: 360,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  deleteIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  deleteMsg: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  modalInput: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalHint: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginTop: -4,
  },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 4, width: "100%" },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalBtnPrimary: { borderWidth: 0 },
});
