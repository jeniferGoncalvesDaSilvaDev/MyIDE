import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIDE } from "@/context/IDEContext";
import { useColors } from "@/hooks/useColors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  desc,
  border = true,
  children,
}: {
  label: string;
  desc?: string;
  border?: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        border && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {desc && <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{desc}</Text>}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { apiKey, setApiKey, githubToken, setGithubToken, lintEnabled, setLintEnabled, files, clearAllFiles } = useIDE();

  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftGH, setDraftGH] = useState(githubToken);
  const [showKey, setShowKey] = useState(false);
  const [showGH, setShowGH] = useState(false);
  const [savedKey, setSavedKey] = useState(false);
  const [savedGH, setSavedGH] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => { setDraftKey(apiKey); }, [apiKey]);
  useEffect(() => { setDraftGH(githubToken); }, [githubToken]);

  async function saveApiKey() {
    await setApiKey(draftKey.trim());
    setSavedKey(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSavedKey(false), 2000);
  }

  async function saveGHToken() {
    await setGithubToken(draftGH.trim());
    setSavedGH(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSavedGH(false), 2000);
  }

  async function handleClearAll() {
    await clearAllFiles();
    setClearConfirm(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: isWeb ? 34 + 84 : insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── AI ── */}
        <Section title="AI Configuration">
          <View style={styles.tokenSection}>
            <View style={styles.tokenHeader}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: apiKey.trim() ? "#22c55e" : colors.mutedForeground }]} />
                <Text style={[styles.statusText, { color: apiKey.trim() ? "#22c55e" : colors.mutedForeground }]}>
                  {apiKey.trim() ? "Anthropic key set" : "No API key"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => Linking.openURL("https://console.anthropic.com")} activeOpacity={0.7}>
                <Text style={[styles.link, { color: colors.primary }]}>Get key ↗</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <TextInput
                style={[styles.tokenInput, { color: colors.foreground }]}
                value={draftKey}
                onChangeText={setDraftKey}
                placeholder="sk-ant-api03-..."
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowKey(!showKey)} activeOpacity={0.7} style={styles.eyeBtn}>
                <Feather name={showKey ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={saveApiKey}
              style={[styles.saveBtn, { backgroundColor: savedKey ? "#22c55e" : colors.primary }]}
              activeOpacity={0.8}
            >
              <Feather name={savedKey ? "check" : "save"} size={15} color="#fff" />
              <Text style={styles.saveBtnText}>{savedKey ? "Saved!" : "Save Key"}</Text>
            </TouchableOpacity>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Stored locally on this device. Used only for AI chat.
            </Text>
          </View>
        </Section>

        {/* ── GitHub Extension ── */}
        <Section title="GitHub Extension">
          <View style={styles.tokenSection}>
            <View style={styles.tokenHeader}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: githubToken.trim() ? "#22c55e" : colors.mutedForeground }]} />
                <Text style={[styles.statusText, { color: githubToken.trim() ? "#22c55e" : colors.mutedForeground }]}>
                  {githubToken.trim() ? "GitHub connected" : "Not connected"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => Linking.openURL("https://github.com/settings/tokens/new?scopes=repo&description=MobileIDE")}
                activeOpacity={0.7}
              >
                <Text style={[styles.link, { color: colors.primary }]}>Create PAT ↗</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <TextInput
                style={[styles.tokenInput, { color: colors.foreground }]}
                value={draftGH}
                onChangeText={setDraftGH}
                placeholder="ghp_..."
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showGH}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowGH(!showGH)} activeOpacity={0.7} style={styles.eyeBtn}>
                <Feather name={showGH ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={saveGHToken}
              style={[styles.saveBtn, { backgroundColor: savedGH ? "#22c55e" : "#24292f" }]}
              activeOpacity={0.8}
            >
              <Feather name={savedGH ? "check" : "github"} size={15} color="#fff" />
              <Text style={styles.saveBtnText}>{savedGH ? "Saved!" : "Save Token"}</Text>
            </TouchableOpacity>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Create a Personal Access Token with repo scope. Tap the GitHub icon in the Files tab to browse your repos.
            </Text>
          </View>
        </Section>

        {/* ── Extensions ── */}
        <Section title="Extensions">
          <Row label="Real-time Linter" desc="Syntax checking for JS, TS, Python, Bash">
            <Switch
              value={lintEnabled}
              onValueChange={setLintEnabled}
              trackColor={{ false: colors.secondary, true: colors.primary + "80" }}
              thumbColor={lintEnabled ? colors.primary : colors.mutedForeground}
            />
          </Row>

          <Row label="Lua / LÖVE 2D" desc="Syntax highlighting + template available" border={false}>
            <View style={[styles.badge, { backgroundColor: "#22c55e20" }]}>
              <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "700" }}>Active</Text>
            </View>
          </Row>
        </Section>

        {/* ── Workspace ── */}
        <Section title="Workspace">
          <Row
            label="Files"
            desc={`${Object.keys(files).length} files in workspace`}
            border={false}
          >
            <TouchableOpacity onPress={() => setClearConfirm(true)} activeOpacity={0.7}>
              <Text style={[styles.dangerLink, { color: colors.destructive }]}>Clear all</Text>
            </TouchableOpacity>
          </Row>
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <Row label="Version" border>
            <Text style={[styles.valueText, { color: colors.mutedForeground }]}>1.0.0</Text>
          </Row>
          <Row label="AI Model" border>
            <Text style={[styles.valueText, { color: colors.mutedForeground }]}>Claude Sonnet 4</Text>
          </Row>
          <Row label="Built with" border={false}>
            <Text style={[styles.valueText, { color: colors.mutedForeground }]}>Expo + React Native</Text>
          </Row>
        </Section>
      </ScrollView>

      {/* ── Clear confirmation modal ── */}
      <Modal
        visible={clearConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setClearConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setClearConfirm(false)} />
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#ef444420" }]}>
              <Feather name="trash-2" size={26} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Clear Workspace</Text>
            <Text style={[styles.modalMsg, { color: colors.mutedForeground }]}>
              All your files will be deleted and replaced with the default sample files. This cannot be undone.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setClearConfirm(false)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearAll}
                style={[styles.modalBtn, { backgroundColor: "#ef4444", borderWidth: 0 }]}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Clear All</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  section: { paddingHorizontal: 16, marginTop: 28, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 4 },
  sectionCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowDesc: { fontSize: 12 },
  tokenSection: { padding: 16, gap: 12 },
  tokenHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "600" },
  link: { fontSize: 13, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  tokenInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  eyeBtn: { padding: 4 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 12, lineHeight: 18 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  valueText: { fontSize: 14 },
  dangerLink: { fontSize: 14, fontWeight: "500" },
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
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalMsg: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4, width: "100%" },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
