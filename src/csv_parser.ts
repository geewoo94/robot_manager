import { parse } from 'csv-parse/sync';
import stringify from 'csvjson-json2csv';

class CsvParser {
  parse = (input: string) => parse(input, { columns: true, cast: true });

  stringify = stringify;
}

export default CsvParser;
