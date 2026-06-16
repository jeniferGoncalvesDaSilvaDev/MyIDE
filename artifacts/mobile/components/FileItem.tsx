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

const LANG_ICONS: Record<string, { lib: "feather" | "material"; name: string }> = {
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
  onPress: () => void;
  onDelete: () => void;
}

export default function FileItem({ file, isActive, onPress, onDelete }: Props) {
  const colors = useColors();
  const langColor = LANG_COLORS[file.language] ?? "#888888";
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  }

  const ext = file.name.split(".").pop()?.toUpperCase() ?? "TXT";

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
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
          style={[
            styles.iconContainer,
            { backgroundColor: langColor + "20" },
          ]}
        >
          <LangIcon language={file.language} size={18} color={langColor} />
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
            {file.name}
          </Text>
          <Text style={[styles.ext, { color: langColor }]}>{ext}</Text>
        </View>

        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.deleteBtn}
          activeOpacity={0.6}
        >
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
