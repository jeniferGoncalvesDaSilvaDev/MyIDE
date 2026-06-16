import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  html: string;
  title: string;
  onClose: () => void;
}

export default function HtmlPreview({ visible, html, title, onClose }: Props) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Feather name="eye" size={14} color={colors.primary} />
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {Platform.OS === "web" ? (
          // On web, use an iframe approach
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html }}
              style={{ flex: 1, backgroundColor: "#fff" }}
              originWhitelist={["*"]}
              scrollEnabled
            />
          </View>
        ) : (
          <WebView
            source={{ html }}
            style={{ flex: 1, backgroundColor: "#fff" }}
            originWhitelist={["*"]}
            scrollEnabled
            allowsInlineMediaPlayback
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
});
