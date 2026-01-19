import crypto from "crypto";

export type AggregateFunction = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT";
export type Operator = "+" | "-" | "*" | "/";
export type ComparisonOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";

export interface ColumnRef {
  type: "column";
  name: string;
}

export interface LiteralValue {
  type: "literal";
  value: string | number;
  dataType: "string" | "number";
}

export interface AggregateExpression {
  type: "aggregate";
  function: AggregateFunction;
  column: string | "*";
  distinct?: boolean;
}

export interface BinaryExpression {
  type: "binary";
  operator: Operator;
  left: MetricExpression;
  right: MetricExpression;
}

export interface FilterCondition {
  column: string;
  operator: ComparisonOperator;
  value: string | number;
}

export interface GroupByClause {
  columns: string[];
}

export type MetricExpression = AggregateExpression | BinaryExpression | LiteralValue;

export interface ValidatedMetric {
  expression: MetricExpression;
  filters: FilterCondition[];
  groupBy: GroupByClause | null;
  referencedColumns: string[];
  isValid: boolean;
  errors: string[];
}

enum TokenType {
  FUNCTION = "FUNCTION",
  IDENTIFIER = "IDENTIFIER",
  NUMBER = "NUMBER",
  STRING = "STRING",
  OPERATOR = "OPERATOR",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  COMMA = "COMMA",
  KEYWORD = "KEYWORD",
  COMPARISON = "COMPARISON",
  STAR = "STAR",
  EOF = "EOF",
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const AGGREGATE_FUNCTIONS = ["SUM", "AVG", "COUNT", "MIN", "MAX"];
const KEYWORDS = ["WHERE", "AND", "OR", "GROUP", "BY", "DISTINCT"];
const OPERATORS = ["+", "-", "*", "/"];
const COMPARISONS = ["=", "!=", ">", "<", ">=", "<="];

class Tokenizer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input.trim();
  }

  tokenize(): Token[] {
    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      if (char === "(") {
        this.tokens.push({ type: TokenType.LPAREN, value: "(", position: this.position });
        this.position++;
      } else if (char === ")") {
        this.tokens.push({ type: TokenType.RPAREN, value: ")", position: this.position });
        this.position++;
      } else if (char === ",") {
        this.tokens.push({ type: TokenType.COMMA, value: ",", position: this.position });
        this.position++;
      } else if (char === "*" && this.peek(1) !== "*") {
        const nextNonSpace = this.peekNonWhitespace();
        if (nextNonSpace === ")" || this.tokens.length === 0 || this.tokens[this.tokens.length - 1].type === TokenType.LPAREN) {
          this.tokens.push({ type: TokenType.STAR, value: "*", position: this.position });
        } else {
          this.tokens.push({ type: TokenType.OPERATOR, value: "*", position: this.position });
        }
        this.position++;
      } else if (this.isComparisonStart(char)) {
        this.readComparison();
      } else if (OPERATORS.includes(char) && char !== "*") {
        this.tokens.push({ type: TokenType.OPERATOR, value: char, position: this.position });
        this.position++;
      } else if (char === "'" || char === '"') {
        this.readString(char);
      } else if (this.isDigit(char) || (char === "-" && this.isDigit(this.peek(1)))) {
        this.readNumber();
      } else if (this.isAlpha(char) || char === "_") {
        this.readIdentifier();
      } else {
        throw new Error(`Unexpected character '${char}' at position ${this.position}`);
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: "", position: this.position });
    return this.tokens;
  }

  private peek(offset: number = 1): string {
    return this.input[this.position + offset] || "";
  }

  private peekNonWhitespace(): string {
    let i = this.position + 1;
    while (i < this.input.length && /\s/.test(this.input[i])) {
      i++;
    }
    return this.input[i] || "";
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isComparisonStart(char: string): boolean {
    return ["=", "!", ">", "<"].includes(char) && !OPERATORS.includes(char);
  }

  private readComparison(): void {
    const start = this.position;
    let value = this.input[this.position];
    this.position++;

    if (this.position < this.input.length && this.input[this.position] === "=") {
      value += "=";
      this.position++;
    }

    if (!COMPARISONS.includes(value)) {
      throw new Error(`Invalid comparison operator '${value}' at position ${start}`);
    }

    this.tokens.push({ type: TokenType.COMPARISON, value, position: start });
  }

  private readString(quote: string): void {
    const start = this.position;
    this.position++;
    let value = "";

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (char === quote) {
        this.position++;
        this.tokens.push({ type: TokenType.STRING, value, position: start });
        return;
      }
      if (char === "\\") {
        this.position++;
        if (this.position < this.input.length) {
          value += this.input[this.position];
        }
      } else {
        value += char;
      }
      this.position++;
    }

    throw new Error(`Unterminated string starting at position ${start}`);
  }

  private readNumber(): void {
    const start = this.position;
    let value = "";

    if (this.input[this.position] === "-") {
      value += "-";
      this.position++;
    }

    while (this.position < this.input.length && (this.isDigit(this.input[this.position]) || this.input[this.position] === ".")) {
      value += this.input[this.position];
      this.position++;
    }

    this.tokens.push({ type: TokenType.NUMBER, value, position: start });
  }

  private readIdentifier(): void {
    const start = this.position;
    let value = "";

    while (this.position < this.input.length && this.isAlphaNumeric(this.input[this.position])) {
      value += this.input[this.position];
      this.position++;
    }

    const upperValue = value.toUpperCase();

    if (AGGREGATE_FUNCTIONS.includes(upperValue)) {
      this.tokens.push({ type: TokenType.FUNCTION, value: upperValue, position: start });
    } else if (KEYWORDS.includes(upperValue)) {
      this.tokens.push({ type: TokenType.KEYWORD, value: upperValue, position: start });
    } else {
      this.tokens.push({ type: TokenType.IDENTIFIER, value, position: start });
    }
  }
}

class Parser {
  private tokens: Token[];
  private position: number = 0;
  private referencedColumns: Set<string> = new Set();
  private errors: string[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ValidatedMetric {
    try {
      const expression = this.parseExpression();
      const { filters, groupBy } = this.parseOptionalClauses();

      return {
        expression,
        filters,
        groupBy,
        referencedColumns: Array.from(this.referencedColumns),
        isValid: this.errors.length === 0,
        errors: this.errors,
      };
    } catch (error: any) {
      this.errors.push(error.message);
      return {
        expression: { type: "literal", value: 0, dataType: "number" },
        filters: [],
        groupBy: null,
        referencedColumns: [],
        isValid: false,
        errors: this.errors,
      };
    }
  }

  private current(): Token {
    return this.tokens[this.position] || { type: TokenType.EOF, value: "", position: -1 };
  }

  private peek(offset: number = 1): Token {
    return this.tokens[this.position + offset] || { type: TokenType.EOF, value: "", position: -1 };
  }

  private advance(): Token {
    const token = this.current();
    this.position++;
    return token;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ""} but got ${token.type} '${token.value}' at position ${token.position}`);
    }
    return this.advance();
  }

  private parseExpression(): MetricExpression {
    return this.parseAdditive();
  }

  private parseAdditive(): MetricExpression {
    let left = this.parseMultiplicative();

    while (this.current().type === TokenType.OPERATOR && ["+", "-"].includes(this.current().value)) {
      const operator = this.advance().value as Operator;
      const right = this.parseMultiplicative();
      left = { type: "binary", operator, left, right };
    }

    return left;
  }

  private parseMultiplicative(): MetricExpression {
    let left = this.parsePrimary();

    while (this.current().type === TokenType.OPERATOR && ["*", "/"].includes(this.current().value)) {
      const operator = this.advance().value as Operator;
      const right = this.parsePrimary();
      left = { type: "binary", operator, left, right };
    }

    return left;
  }

  private parsePrimary(): MetricExpression {
    const token = this.current();

    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    if (token.type === TokenType.NUMBER) {
      this.advance();
      return { type: "literal", value: parseFloat(token.value), dataType: "number" };
    }

    if (token.type === TokenType.FUNCTION) {
      return this.parseAggregate();
    }

    throw new Error(`Unexpected token ${token.type} '${token.value}' at position ${token.position}`);
  }

  private parseAggregate(): AggregateExpression {
    const funcToken = this.expect(TokenType.FUNCTION);
    this.expect(TokenType.LPAREN);

    let distinct = false;
    let column: string = "*";

    if (this.current().type === TokenType.KEYWORD && this.current().value === "DISTINCT") {
      distinct = true;
      this.advance();
    }

    if (this.current().type === TokenType.STAR) {
      this.advance();
      column = "*";
    } else if (this.current().type === TokenType.IDENTIFIER) {
      column = this.advance().value;
      this.referencedColumns.add(column);
    } else {
      throw new Error(`Expected column name or * at position ${this.current().position}`);
    }

    this.expect(TokenType.RPAREN);

    const func = funcToken.value as AggregateFunction;
    const mappedFunc: AggregateFunction = distinct && func === "COUNT" ? "COUNT_DISTINCT" : func;

    return {
      type: "aggregate",
      function: mappedFunc,
      column,
      distinct,
    };
  }

  private parseOptionalClauses(): { filters: FilterCondition[]; groupBy: GroupByClause | null } {
    const filters: FilterCondition[] = [];
    let groupBy: GroupByClause | null = null;

    while (this.current().type === TokenType.KEYWORD) {
      if (this.current().value === "WHERE") {
        this.advance();
        filters.push(...this.parseFilters());
      } else if (this.current().value === "GROUP") {
        this.advance();
        this.expect(TokenType.KEYWORD, "BY");
        groupBy = this.parseGroupBy();
      } else {
        break;
      }
    }

    return { filters, groupBy };
  }

  private parseFilters(): FilterCondition[] {
    const filters: FilterCondition[] = [];

    do {
      if (this.current().type === TokenType.KEYWORD && this.current().value === "AND") {
        this.advance();
      }

      if (this.current().type !== TokenType.IDENTIFIER) {
        break;
      }

      const column = this.advance().value;
      this.referencedColumns.add(column);

      if (this.current().type !== TokenType.COMPARISON) {
        throw new Error(`Expected comparison operator at position ${this.current().position}`);
      }
      const operator = this.advance().value as ComparisonOperator;

      let value: string | number;
      if (this.current().type === TokenType.STRING) {
        value = this.advance().value;
      } else if (this.current().type === TokenType.NUMBER) {
        value = parseFloat(this.advance().value);
      } else {
        throw new Error(`Expected value at position ${this.current().position}`);
      }

      filters.push({ column, operator, value });
    } while (this.current().type === TokenType.KEYWORD && this.current().value === "AND");

    return filters;
  }

  private parseGroupBy(): GroupByClause {
    const columns: string[] = [];

    do {
      if (this.current().type === TokenType.COMMA) {
        this.advance();
      }

      if (this.current().type !== TokenType.IDENTIFIER) {
        break;
      }

      const column = this.advance().value;
      this.referencedColumns.add(column);
      columns.push(column);
    } while (this.current().type === TokenType.COMMA);

    return { columns };
  }
}

export function parseMetricExpression(dsl: string): ValidatedMetric {
  if (!dsl || typeof dsl !== "string") {
    return {
      expression: { type: "literal", value: 0, dataType: "number" },
      filters: [],
      groupBy: null,
      referencedColumns: [],
      isValid: false,
      errors: ["DSL expression is required"],
    };
  }

  try {
    const tokenizer = new Tokenizer(dsl);
    const tokens = tokenizer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  } catch (error: any) {
    return {
      expression: { type: "literal", value: 0, dataType: "number" },
      filters: [],
      groupBy: null,
      referencedColumns: [],
      isValid: false,
      errors: [error.message],
    };
  }
}

export function validateColumnNames(columns: string[], schema: string[]): { valid: boolean; invalidColumns: string[] } {
  const schemaSet = new Set(schema.map((c) => c.toLowerCase()));
  const invalidColumns: string[] = [];

  for (const col of columns) {
    if (col === "*") continue;
    if (!schemaSet.has(col.toLowerCase())) {
      invalidColumns.push(col);
    }
  }

  return {
    valid: invalidColumns.length === 0,
    invalidColumns,
  };
}

export function validateMetricAgainstSchema(metric: ValidatedMetric, tableColumns: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [...metric.errors];

  const columnValidation = validateColumnNames(metric.referencedColumns, tableColumns);
  if (!columnValidation.valid) {
    errors.push(`Invalid columns: ${columnValidation.invalidColumns.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function sanitizeIdentifier(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, "");
  if (!sanitized || /^\d/.test(sanitized)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${sanitized}"`;
}

function expressionToSQL(expr: MetricExpression): string {
  switch (expr.type) {
    case "literal":
      if (expr.dataType === "number") {
        return String(expr.value);
      }
      return `'${String(expr.value).replace(/'/g, "''")}'`;

    case "aggregate": {
      const col = expr.column === "*" ? "*" : sanitizeIdentifier(expr.column);
      if (expr.function === "COUNT_DISTINCT") {
        return `COUNT(DISTINCT ${col})`;
      }
      return `${expr.function}(${col})`;
    }

    case "binary":
      return `(${expressionToSQL(expr.left)} ${expr.operator} ${expressionToSQL(expr.right)})`;

    default:
      throw new Error("Unknown expression type");
  }
}

function filterToSQL(filter: FilterCondition, paramIndex: number): { sql: string; value: string | number } {
  const col = sanitizeIdentifier(filter.column);
  const placeholder = `$${paramIndex}`;
  return {
    sql: `${col} ${filter.operator} ${placeholder}`,
    value: filter.value,
  };
}

export function translateToSQL(
  metric: ValidatedMetric,
  tableName: string
): { sql: string; parameters: (string | number)[] } {
  if (!metric.isValid) {
    throw new Error(`Invalid metric: ${metric.errors.join(", ")}`);
  }

  const sanitizedTable = sanitizeIdentifier(tableName);
  const selectExpr = expressionToSQL(metric.expression);
  const parameters: (string | number)[] = [];

  let sql = `SELECT ${selectExpr} AS result`;

  if (metric.groupBy && metric.groupBy.columns.length > 0) {
    const groupCols = metric.groupBy.columns.map(sanitizeIdentifier).join(", ");
    sql = `SELECT ${groupCols}, ${selectExpr} AS result`;
  }

  sql += ` FROM ${sanitizedTable}`;

  if (metric.filters.length > 0) {
    const whereClauses: string[] = [];
    for (let i = 0; i < metric.filters.length; i++) {
      const { sql: filterSQL, value } = filterToSQL(metric.filters[i], i + 1);
      whereClauses.push(filterSQL);
      parameters.push(value);
    }
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }

  if (metric.groupBy && metric.groupBy.columns.length > 0) {
    const groupCols = metric.groupBy.columns.map(sanitizeIdentifier).join(", ");
    sql += ` GROUP BY ${groupCols}`;
  }

  return { sql, parameters };
}

export function computeQueryHash(sql: string, params: (string | number)[]): string {
  const data = JSON.stringify({ sql, params });
  return crypto.createHash("sha256").update(data).digest("hex");
}
