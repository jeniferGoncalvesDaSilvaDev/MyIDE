import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
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

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  borderBottom?: boolean;
}

function SettingRow({ label, description, children, borderBottom = true }: SettingRowProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.settingRow,
        borderBottom && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
            {description}
          </Text>
        )}
      </View>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { apiKey, setApiKey, files, createFile } = useIDE();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  useEffect(() => {
    setDraftKey(apiKey);
  }, [apiKey]);

  async function saveApiKey() {
    await setApiKey(draftKey.trim());
    setSaved(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setSaved(false), 2000);
  }

  function openConsole() {
    Linking.openURL("https://console.anthropic.com");
  }

  const keyIsSet = apiKey.trim().length > 0;

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: isWeb ? 34 + 84 : insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="AI Configuration">
          <View style={styles.apiKeySection}>
            <View style={styles.apiKeyHeader}>
              <View style={styles.apiKeyStatus}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: keyIsSet
                        ? "#22c55e"
                        : colors.mutedForeground,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.apiKeyStatusText,
                    {
                      color: keyIsSet ? "#22c55e" : colors.mutedForeground,
                    },
                  ]}
                >
                  {keyIsSet ? "API key set" : "No API key"}
                </Text>
              </View>
              <TouchableOpacity onPress={openConsole} activeOpacity={0.7}>
                <Text style={[styles.getKeyLink, { color: colors.primary }]}>
                  Get key
                </Text>
              </TouchableOpacity>
            </View>

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
                style={[styles.apiKeyInput, { color: colors.foreground }]}
                value={draftKey}
                onChangeText={setDraftKey}
                placeholder="sk-ant-api03-..."
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowKey(!showKey)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Feather
                  name={showKey ? "eye-off" : "eye"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={saveApiKey}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: saved ? "#22c55e" : colors.primary,
                },
              ]}
              activeOpacity={0.8}
            >
              {saved ? (
                <Feather name="check" size={16} color="#fff" />
              ) : (
                <Feather name="save" size={16} color="#fff" />
              )}
              <Text style={styles.saveBtnText}>
                {saved ? "Saved!" : "Save Key"}
              </Text>
            </TouchableOpacity>

            <Text
              style={[styles.apiKeyHint, { color: colors.mutedForeground }]}
            >
              Your key is stored locally on this device and only used for AI
              chat requests.
            </Text>
          </View>
        </Section>

        <Section title="Workspace">
          <SettingRow
            label="Files"
            description={`${Object.keys(files).length} files in your workspace`}
            borderBottom={false}
          >
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Clear Workspace",
                  "Delete all files? Sample files will be restored.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear",
                      style: "destructive",
                      onPress: async () => {
                        await createFile("main.ts");
                        router.navigate("/(tabs)/files");
                      },
                    },
                  ]
                )
              }
              activeOpacity={0.7}
            >
              <Text
                style={[styles.dangerLink, { color: colors.destructive }]}
              >
                Clear all
              </Text>
            </TouchableOpacity>
          </SettingRow>
        </Section>

        <Section title="About">
          <SettingRow label="Version" borderBottom>
            <Text style={[styles.valueText, { color: colors.mutedForeground }]}>
              1.0.0
            </Text>
          </SettingRow>
          <SettingRow label="Model" borderBottom>
            <Text style={[styles.valueText, { color: colors.mutedForeground }]}>
              Claude Sonnet 4
            </Text>
          </SettingRow>
          <SettingRow label="Built with" borderBottom={false}>
            <Text style={[styles.valueText, { color: colors.mutedForeground }]}>
              Expo + React Native
            </Text>
          </SettingRow>
        </Section>
      </ScrollView>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 28,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingInfo: {
    flex: 1,
    gap: 3,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  settingDesc: {
    fontSize: 12,
  },
  settingControl: {
    alignItems: "flex-end",
  },
  apiKeySection: {
    padding: 16,
    gap: 12,
  },
  apiKeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  apiKeyStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  apiKeyStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  getKeyLink: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  apiKeyInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  eyeBtn: {
    padding: 4,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  apiKeyHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  valueText: {
    fontSize: 14,
  },
  dangerLink: {
    fontSize: 14,
    fontWeight: "500",
  },
});
