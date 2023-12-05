/**
 * This converts Postfinance exports (of various forms) into Freeagent import CSVs of the form:
 *
 * ```
 * date | value | details
 * ```
 *
 * where date is of the form 19/01/2023
 * and details are double quoted
 */

import { exit } from "process";
import fs from "fs";
import { DateTime } from "luxon";

type Entry = {
  date: DateTime;
  credit: number;
  debit: number;
  details: string;
};

type Parser = {
  name: string;
  header: string;
  toEntry: (columns: string[]) => Entry;
};

const filename = process.argv[2];

if ((filename ?? "").trim().length === 0) {
  console.error("You must provide a filename to a Postfinance CSV export.");
  exit(1);
}

const lines = fs.readFileSync(filename).toString().split("\r\n");

const parsers: Parser[] = [
  {
    name: "account parser",
    header: "Date;Type of transaction;Notification text;Credit in CHF;Debit in CHF",
    toEntry: (columns) => ({
      date: DateTime.fromFormat(columns[0], "dd.MM.yyyy"),
      credit: parseFloat(columns[3]) || 0,
      debit: parseFloat(columns[4]) || 0,
      details: columns[2]
    })
  },
  {
    name: "credit card parser",
    header: "Date;Booking details;Credit in CHF;Debit in CHF",
    toEntry: (columns) => ({
      date: DateTime.fromFormat(columns[0], "yyyy-MM-dd"),
      credit: parseFloat(columns[2]) || 0,
      debit: parseFloat(columns[3]) || 0,
      details: columns[1]
    })
  }
];

// Choose a parser by the presence of its header
const parser = parsers.find((parser) => lines.indexOf(parser.header) >= 0);

if (!parser) {
  console.error("No parser is available to parser this file (no matching header).");
  exit(1);
}

// Get the starting line (after the header)
const startingLineIdx = lines.indexOf(parser.header) + 1;

// Convert the file into entries
const entries = lines
  .splice(startingLineIdx)
  // We only care about lines that start with a digit (they are the transactions)
  .filter((line) => line.match(/^[0-9].*$/))
  // Convert each line to an entry
  .map((line) => parser.toEntry(line.split(";")));

// Format the entries for Postfinance
const output = entries
  .map((entry) => [entry.date.toFormat("dd/MM/yyyy"), entry.credit + entry.debit, entry.details].join(","))
  .join("\n");

console.log(output);
