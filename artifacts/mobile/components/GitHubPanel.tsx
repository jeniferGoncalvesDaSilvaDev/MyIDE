import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useIDE } from "@/context/IDEContext";

interface GHUser {
  login: string;
  name: string | null;
  public_repos: number;
}

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

interface GHContent {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  download_url: string | null;
  content?: string;
  encoding?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export default function GitHubPanel({ visible, onClose }: Props) {
  const colors = useColors();
  const { githubToken, createFile, updateFileContent } = useIDE();

  const [user, setUser] = useState<GHUser | null>(null);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GHRepo | null>(null);
  const [pathStack, setPathStack] = useState<string[]>([""]);
  const [contents, setContents] = useState<GHContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedPaths, setImportedPaths] = useState<Set<string>>(new Set());

  const hasToken = !!githubToken.trim();

  useEffect(() => {
    if (visible && hasToken) loadUser();
  }, [visible, githubToken]);

  async function loadUser() {
    setLoading(true);
    setError(null);
    try {
      const [uRes, rRes] = await Promise.all([
        fetch("https://api.github.com/user", { headers: ghHeaders(githubToken) }),
        fetch("https://api.github.com/user/repos?per_page=30&sort=updated&affiliation=owner", {
          headers: ghHeaders(githubToken),
        }),
      ]);
      if (!uRes.ok) throw new Error(uRes.status === 401 ? "Invalid token — check Settings." : `GitHub error ${uRes.status}`);
      const u = (await uRes.json()) as GHUser;
      const r = rRes.ok ? ((await rRes.json()) as GHRepo[]) : [];
      setUser(u);
      setRepos(r);
    } catch (e: any) {
      setError(e.message ?? "Failed to connect to GitHub");
    } finally {
      setLoading(false);
    }
  }

  const browseRepo = useCallback(
    async (repo: GHRepo, path = "") => {
      setLoading(true);
      setError(null);
      try {
        const url = `https://api.github.com/repos/${repo.full_name}/contents/${path}?ref=${repo.default_branch}`;
        const res = await fetch(url, { headers: ghHeaders(githubToken) });
        if (!res.ok) throw new Error(`GitHub error ${res.status}`);
        const data = (await res.json()) as GHContent[];
        const sorted = [...data].sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setContents(sorted);
        setSelectedRepo(repo);
        setPathStack(path ? ["", ...path.split("/")] : [""]);
      } catch (e: any) {
        setError(e.message ?? "Failed to load repo");
      } finally {
        setLoading(false);
      }
    },
    [githubToken]
  );

  async function importFile(item: GHContent) {
    if (!selectedRepo) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${selectedRepo.full_name}/contents/${item.path}?ref=${selectedRepo.default_branch}`,
        { headers: ghHeaders(githubToken) }
      );
      if (!res.ok) throw new Error(`GitHub error ${res.status}`);
      const data = (await res.json()) as GHContent;
      const content = data.content
        ? atob(data.content.replace(/\n/g, ""))
        : "";
      const localPath = item.path;
      await createFile(localPath);
      await updateFileContent(localPath, content);
      setImportedPaths((prev) => new Set([...prev, item.path]));
    } catch (e: any) {
      setError(e.message ?? "Failed to import file");
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (pathStack.length <= 1 || (pathStack.length === 2 && pathStack[0] === "")) {
      setSelectedRepo(null);
      setContents([]);
      setPathStack([""]);
    } else {
      const newStack = pathStack.slice(0, -1);
      const newPath = newStack.filter(Boolean).join("/");
      browseRepo(selectedRepo!, newPath);
    }
  }

  function close() {
    setSelectedRepo(null);
    setContents([]);
    setPathStack([""]);
    setError(null);
    onClose();
  }

  const currentPath = pathStack.filter(Boolean).join("/");
  const breadcrumb = selectedRepo
    ? [selectedRepo.name, ...pathStack.filter(Boolean)].join(" / ")
    : "Repositories";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {selectedRepo ? (
            <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={styles.backBtn}>
              <Feather name="chevron-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}

          <View style={styles.headerCenter}>
            <Feather name="github" size={16} color={colors.foreground} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {breadcrumb}
            </Text>
          </View>

          <TouchableOpacity onPress={close} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {!hasToken ? (
          <View style={styles.noToken}>
            <Feather name="lock" size={40} color={colors.mutedForeground} />
            <Text style={[styles.noTokenTitle, { color: colors.foreground }]}>
              GitHub token required
            </Text>
            <Text style={[styles.noTokenHint, { color: colors.mutedForeground }]}>
              Go to Settings → GitHub Extension and add your Personal Access Token (PAT) to connect.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={32} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            <TouchableOpacity
              onPress={loadUser}
              style={[styles.retryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.foreground, fontSize: 14 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !selectedRepo ? (
          // Repo list
          <>
            {user && (
              <View style={[styles.userRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.userAvatar, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.userInitial, { color: colors.primary }]}>
                    {(user.name ?? user.login)[0].toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.userName, { color: colors.foreground }]}>
                    {user.name ?? user.login}
                  </Text>
                  <Text style={[styles.userLogin, { color: colors.mutedForeground }]}>
                    @{user.login} · {user.public_repos} repos
                  </Text>
                </View>
              </View>
            )}
            <FlatList
              data={repos}
              keyExtractor={(r) => String(r.id)}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => browseRepo(item)}
                  activeOpacity={0.7}
                  style={[styles.repoItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.repoMain}>
                    <View style={styles.repoNameRow}>
                      <Feather
                        name={item.private ? "lock" : "book"}
                        size={14}
                        color={colors.mutedForeground}
                      />
                      <Text style={[styles.repoName, { color: colors.primary }]}>
                        {item.name}
                      </Text>
                      {item.private && (
                        <View style={[styles.privateBadge, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.privateBadgeText, { color: colors.mutedForeground }]}>private</Text>
                        </View>
                      )}
                    </View>
                    {item.description && (
                      <Text style={[styles.repoDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                    <View style={styles.repoMeta}>
                      {item.language && (
                        <Text style={[styles.repoMetaText, { color: colors.mutedForeground }]}>
                          {item.language}
                        </Text>
                      )}
                      {item.stargazers_count > 0 && (
                        <View style={styles.repoMetaItem}>
                          <Feather name="star" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.repoMetaText, { color: colors.mutedForeground }]}>
                            {item.stargazers_count}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                    No repositories found
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          // File browser
          <FlatList
            data={contents}
            keyExtractor={(c) => c.sha + c.path}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const alreadyImported = importedPaths.has(item.path);
              return (
                <TouchableOpacity
                  onPress={() =>
                    item.type === "dir"
                      ? browseRepo(selectedRepo!, item.path)
                      : importFile(item)
                  }
                  activeOpacity={0.7}
                  style={[styles.fileItem, { borderBottomColor: colors.border }]}
                >
                  <Feather
                    name={item.type === "dir" ? "folder" : "file-text"}
                    size={16}
                    color={item.type === "dir" ? "#f2cc60" : colors.mutedForeground}
                  />
                  <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.type === "file" && (
                    <View style={styles.fileRight}>
                      {item.size > 0 && (
                        <Text style={[styles.fileSize, { color: colors.mutedForeground }]}>
                          {item.size > 1024 ? `${(item.size / 1024).toFixed(1)}kb` : `${item.size}b`}
                        </Text>
                      )}
                      {alreadyImported ? (
                        <View style={[styles.importedBadge, { backgroundColor: "#22c55e20" }]}>
                          <Feather name="check" size={12} color="#22c55e" />
                          <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "600" }}>Imported</Text>
                        </View>
                      ) : (
                        <View style={[styles.importBtn, { backgroundColor: colors.primary + "20" }]}>
                          <Feather name="download" size={12} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>Import</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {item.type === "dir" && (
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 2 },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerTitle: { fontSize: 15, fontWeight: "600" },
  noToken: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  noTokenTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  noTokenHint: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userInitial: { fontSize: 18, fontWeight: "700" },
  userName: { fontSize: 15, fontWeight: "600" },
  userLogin: { fontSize: 12, marginTop: 2 },
  repoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  repoMain: { flex: 1, gap: 4 },
  repoNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  repoName: { fontSize: 14, fontWeight: "600" },
  repoDesc: { fontSize: 12, lineHeight: 18 },
  repoMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  repoMetaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  repoMetaText: { fontSize: 11 },
  privateBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  privateBadgeText: { fontSize: 10, fontWeight: "600" },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  fileName: { flex: 1, fontSize: 14 },
  fileRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileSize: { fontSize: 11 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  importedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
