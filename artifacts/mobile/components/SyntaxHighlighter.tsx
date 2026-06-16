import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";

type TokenType =
  | "keyword"
  | "type"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "plain";

interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for",
  "while", "class", "extends", "import", "export", "from", "default",
  "new", "this", "typeof", "instanceof", "null", "undefined", "true",
  "false", "async", "await", "try", "catch", "finally", "throw", "delete",
  "in", "of", "do", "switch", "case", "break", "continue", "static",
  "public", "private", "protected", "readonly", "abstract", "yield",
  "def", "print", "and", "or", "not", "is", "pass", "with", "as",
  "lambda", "raise", "except", "elif",
]);

const TYPES = new Set([
  "interface", "type", "enum", "void", "never", "any", "string", "number",
  "boolean", "object", "namespace", "module", "declare", "implements",
]);

function tokenizeLine(line: string, language: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }
    if (line[i] === "/" && line[i + 1] === "*") {
      let j = i + 2;
      while (j < line.length - 1 && !(line[j] === "*" && line[j + 1] === "/")) j++;
      tokens.push({ type: "comment", value: line.slice(i, j + 2) });
      i = j + 2;
      continue;
    }
    if ((language === "python" || language === "bash" || language === "yaml") && line[i] === "#") {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }

    if (line[i] === "'" || line[i] === '"' || line[i] === "`") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[0-9._xXa-fA-F]/.test(line[j])) j++;
      tokens.push({ type: "number", value: line.slice(i, j) });
      i = j;
      continue;
    }

    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const rest = line.slice(j).trimStart();
      const isCall = rest.startsWith("(");

      if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (TYPES.has(word)) {
        tokens.push({ type: "type", value: word });
      } else if (isCall) {
        tokens.push({ type: "function", value: word });
      } else {
        tokens.push({ type: "plain", value: word });
      }
      i = j;
      continue;
    }

    tokens.push({ type: "plain", value: line[i] });
    i++;
  }

  return tokens.length > 0 ? tokens : [{ type: "plain", value: "" }];
}

interface SyntaxColors {
  keyword: string;
  type: string;
  string: string;
  comment: string;
  number: string;
  function: string;
  plain: string;
}

const DARK_SYNTAX: SyntaxColors = {
  keyword: "#ff7b72",
  type: "#79c0ff",
  string: "#a5d6ff",
  comment: "#8b949e",
  number: "#f2cc60",
  function: "#d2a8ff",
  plain: "#e6edf3",
};

const LIGHT_SYNTAX: SyntaxColors = {
  keyword: "#cf222e",
  type: "#0550ae",
  string: "#0a3069",
  comment: "#6e7781",
  number: "#0550ae",
  function: "#8250df",
  plain: "#1f2328",
};

interface Props {
  code: string;
  language: string;
  fontSize?: number;
  showLineNumbers?: boolean;
}

const TokenText = memo(function TokenText({
  token,
  syntax,
  fontSize,
}: {
  token: Token;
  syntax: SyntaxColors;
  fontSize: number;
}) {
  return (
    <Text style={{ color: syntax[token.type], fontSize, fontFamily: MONO_FONT }}>
      {token.value}
    </Text>
  );
});

const CodeLine = memo(function CodeLine({
  line,
  lineNumber,
  language,
  syntax,
  lineNumberColor,
  fontSize,
  showLineNumbers,
}: {
  line: string;
  lineNumber: number;
  language: string;
  syntax: SyntaxColors;
  lineNumberColor: string;
  fontSize: number;
  showLineNumbers: boolean;
}) {
  const tokens = tokenizeLine(line, language);
  return (
    <View style={styles.lineRow}>
      {showLineNumbers && (
        <Text
          style={[
            styles.lineNumber,
            { color: lineNumberColor, fontSize: fontSize - 1 },
          ]}
        >
          {String(lineNumber).padStart(3, " ")}
        </Text>
      )}
      <View style={styles.lineContent}>
        {tokens.map((token, idx) => (
          <TokenText key={idx} token={token} syntax={syntax} fontSize={fontSize} />
        ))}
      </View>
    </View>
  );
});

export const MONO_FONT =
  require("react-native").Platform.OS === "ios"
    ? "Menlo"
    : require("react-native").Platform.OS === "android"
    ? "monospace"
    : "Courier New, monospace";

export default function SyntaxHighlighter({
  code,
  language,
  fontSize = 13,
  showLineNumbers = true,
}: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const syntax = scheme === "dark" ? DARK_SYNTAX : LIGHT_SYNTAX;
  const lines = code.split("\n");

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ minWidth: "100%" }}
    >
      <View style={styles.codeContainer}>
        {lines.map((line, idx) => (
          <CodeLine
            key={idx}
            line={line}
            lineNumber={idx + 1}
            language={language}
            syntax={syntax}
            lineNumberColor={colors.mutedForeground}
            fontSize={fontSize}
            showLineNumbers={showLineNumbers}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  codeContainer: {
    paddingVertical: 12,
    paddingRight: 24,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 20,
  },
  lineNumber: {
    width: 36,
    textAlign: "right",
    paddingRight: 12,
    opacity: 0.5,
    fontFamily: "Menlo",
    lineHeight: 20,
  },
  lineContent: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "flex-start",
    flex: 1,
  },
});
