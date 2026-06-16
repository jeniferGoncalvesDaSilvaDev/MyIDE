import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { FileNode } from "@/context/IDEContext";

export const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f0db4f",
  python: "#3776ab",
  css: "#264de4",
  html: "#e34c26",
  json: "#5c9eb0",
  markdown: "#083fa1",
  bash: "#4eaa25",
  yaml: "#cb171e",
  text: "#888888",
  java: "#b07219",
  ruby: "#cc342d",
  go: "#00add8",
  rust: "#dea584",
  cpp: "#f34b7d",
  c: "#555555",
  php: "#777bb4",
};

const LANG_ICONS: Record<
  string,
  { lib: "feather" | "material"; name: string }
> = {
  typescript: { lib: "material", name: "language-typescript" },
  javascript: { lib: "material", name: "language-javascript" },
  python: { lib: "material", name: "language-python" },
  css: { lib: "material", name: "language-css3" },
  html: { lib: "material", name: "language-html5" },
  json: { lib: "material", name: "code-json" },
  markdown: { lib: "material", name: "language-markdown" },
  bash: { lib: "feather", name: "terminal" },
  yaml: { lib: "feather", name: "file-text" },
  text: { lib: "feather", name: "file-text" },
  java: { lib: "material", name: "language-java" },
  ruby: { lib: "material", name: "language-ruby" },
  go: { lib: "material", name: "language-go" },
  rust: { lib: "material", name: "language-rust" },
  cpp: { lib: "material", name: "language-cpp" },
  c: { lib: "material", name: "language-c" },
  php: { lib: "material", name: "language-php" },
};

function LangIcon({
  language,
  size,
  color,
}: {
  language: string;
  size: number;
  color: string;
}) {
  const icon = LANG_ICONS[language] ?? { lib: "feather", name: "file" };
  if (icon.lib === "material") {
    return (
      <MaterialCommunityIcons
        name={icon.name as any}
        size={size}
        color={color}
      />
    );
  }
  return <Feather name={icon.name as any} size={size} color={color} />;
}

interface Props {
  file: FileNode;
  isActive: boolean;
  depth?: number;
  onPress: () => void;
  onDelete: () => void;
}

export default function FileItem({
  file,
  isActive,
  depth = 0,
  onPress,
  onDelete,
}: Props) {
  const colors = useColors();
  const langColor = LANG_COLORS[file.language] ?? "#888888";
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 70,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  }

  // Show only the filename (not full path) when in a folder
  const displayName = file.name.includes("/")
    ? file.name.split("/").pop() ?? file.name
    : file.name;
  const ext = displayName.split(".").pop()?.toUpperCase() ?? "TXT";

  return (
    <Animated.View
      style={[
        styles.row,
        { transform: [{ scale: scaleAnim }] },
        { paddingLeft: 8 + depth * 20 },
      ]}
    >
      {/* Indent guide line */}
      {depth > 0 && (
        <View
          style={[styles.indentLine, { backgroundColor: colors.border }]}
        />
      )}

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={[
          styles.container,
          {
            backgroundColor: isActive ? colors.secondary : "transparent",
            borderColor: isActive ? colors.primary + "40" : "transparent",
          },
        ]}
      >
        <View
          style={[styles.iconContainer, { backgroundColor: langColor + "20" }]}
        >
          <LangIcon language={file.language} size={17} color={langColor} />
        </View>

        <View style={styles.textContainer}>
          <Text
            style={[
              styles.filename,
              {
                color: isActive ? colors.primary : colors.foreground,
                fontWeight: isActive ? "600" : "400",
              },
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[styles.ext, { color: langColor }]}>{ext}</Text>
        </View>
      </TouchableOpacity>

      {/* Delete button OUTSIDE the main touchable — fixes tap not registering */}
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.deleteBtn}
        activeOpacity={0.5}
      >
        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginVertical: 2,
    position: "relative",
  },
  indentLine: {
    position: "absolute",
    left: 28,
    top: 0,
    bottom: 0,
    width: 1,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  filename: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  ext: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 2,
  },
});
