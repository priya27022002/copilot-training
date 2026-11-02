#!/usr/bin/env node

/**
 * CSV Email Validator CLI.
 *
 * Usage:
 *   node validate-csv.js path/to/file.csv
 *
 * Behavior:
 * - Requires an `email` column in the CSV header.
 * - Validates each data row.
 * - Prints invalid rows as: Line Number | Email | Reason
 * - Prints summary counts.
 * - Exits with code 0 when all rows are valid, otherwise 1.
 */

const fs = require("node:fs");

function printUsage() {
  console.error("Usage: node validate-csv.js <path-to-csv>");
}

function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }

      row.push(current);
      current = "";

      const isBlankRow = row.every((cell) => cell.trim() === "");
      if (!isBlankRow) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unterminated quoted field.");
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    const isBlankRow = row.every((cell) => cell.trim() === "");
    if (!isBlankRow) {
      rows.push(row);
    }
  }

  return rows;
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;

  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;

  const emailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*$/;
  return emailPattern.test(trimmed);
}

function validateCsvFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read file: ${error.message}`);
  }

  if (content.trim() === "") {
    throw new Error("CSV file is empty.");
  }

  let rows;
  try {
    rows = parseCsv(content);
  } catch (error) {
    throw new Error(`Malformed CSV: ${error.message}`);
  }

  if (rows.length === 0) {
    throw new Error("CSV file contains no rows.");
  }

  const header = rows[0].map((cell) => cell.trim());
  const emailIndex = header.findIndex((cell) => cell.toLowerCase() === "email");

  if (emailIndex === -1) {
    throw new Error("Missing required 'email' column in the header.");
  }

  const dataRows = rows.slice(1);
  let validRows = 0;
  let invalidRows = 0;
  const invalidEntries = [];

  dataRows.forEach((row, index) => {
    const lineNumber = index + 2;

    if (row.length !== header.length) {
      invalidRows += 1;
      invalidEntries.push({ lineNumber, email: "", reason: "Malformed row: column count mismatch" });
      return;
    }

    const email = (row[emailIndex] || "").trim();
    if (!email) {
      invalidRows += 1;
      invalidEntries.push({ lineNumber, email: "", reason: "Missing email value" });
      return;
    }

    if (!isValidEmail(email)) {
      invalidRows += 1;
      invalidEntries.push({ lineNumber, email, reason: "Invalid email address" });
      return;
    }

    validRows += 1;
  });

  console.log("Line Number | Email | Reason");
  if (invalidEntries.length === 0) {
    console.log("- | - | All rows valid");
  } else {
    invalidEntries.forEach(({ lineNumber, email, reason }) => {
      console.log(`${lineNumber} | ${email || ""} | ${reason}`);
    });
  }

  console.log("\nValidation Summary");
  console.log(`Total Rows: ${dataRows.length}`);
  console.log(`Valid Rows: ${validRows}`);
  console.log(`Invalid Rows: ${invalidRows}`);

  return invalidRows === 0;
}

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    printUsage();
    process.exit(1);
  }

  try {
    const allValid = validateCsvFile(filePath);
    process.exitCode = allValid ? 0 : 1;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

module.exports = {
  parseCsv,
  isValidEmail,
  validateCsvFile,
};
