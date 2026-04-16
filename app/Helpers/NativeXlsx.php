<?php

namespace App\Helpers;

/**
 * NativeXlsx — Generatore XLSX senza dipendenze esterne.
 * Usa ZipArchive + template XML minimale.
 *
 * Usage:
 *   $xlsx = new NativeXlsx();
 *   $xlsx->addSheet('Sheet1', $headers, $rows);
 *   $bytes = $xlsx->generate(); // returns raw binary
 */
class NativeXlsx
{
    private array $sheets = [];

    /** Aggiunge un foglio di calcolo. $rows = array of assoc arrays. */
    public function addSheet(string $name, array $headers, array $rows): self
    {
        $this->sheets[] = ['name' => $name, 'headers' => $headers, 'rows' => $rows];
        return $this;
    }

    /** Genera e restituisce il contenuto binario del file .xlsx */
    public function generate(): string
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'xlsx_');

        $zip = new \ZipArchive();
        if ($zip->open($tmpFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Impossibile creare il file ZIP temporaneo.');
        }

        $sheetCount = count($this->sheets);

        // ── [Content_Types].xml ──────────────────────────────────────────────
        $ctParts = '';
        for ($i = 1; $i <= $sheetCount; $i++) {
            $ctParts .= "<Override PartName=\"/xl/worksheets/sheet{$i}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
        }
        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ' . $ctParts . '
</Types>';
        $zip->addFromString('[Content_Types].xml', $contentTypes);

        // ── _rels/.rels ──────────────────────────────────────────────────────
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>');

        // ── xl/_rels/workbook.xml.rels ───────────────────────────────────────
        $wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
        for ($i = 1; $i <= $sheetCount; $i++) {
            $wbRels .= "<Relationship Id=\"rId{$i}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{$i}.xml\"/>";
        }
        $wbRels .= '<Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
        $wbRels .= '</Relationships>';
        $zip->addFromString('xl/_rels/workbook.xml.rels', $wbRels);

        // ── xl/workbook.xml ──────────────────────────────────────────────────
        $sheetEntries = '';
        foreach ($this->sheets as $idx => $sheet) {
            $rId = $idx + 1;
            $escapedName = htmlspecialchars($sheet['name'], ENT_XML1);
            $sheetEntries .= "<sheet name=\"{$escapedName}\" sheetId=\"{$rId}\" r:id=\"rId{$rId}\"/>";
        }
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>' . $sheetEntries . '</sheets>
</workbook>');

        // ── xl/styles.xml ────────────────────────────────────────────────────
        $zip->addFromString('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>');

        // ── xl/worksheets/sheetN.xml ────────────────────────────────────────
        foreach ($this->sheets as $idx => $sheet) {
            $sheetXml  = $this->buildSheetXml($sheet['headers'], $sheet['rows']);
            $zip->addFromString('xl/worksheets/sheet' . ($idx + 1) . '.xml', $sheetXml);
        }

        $zip->close();

        $bytes = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return $bytes;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function buildSheetXml(array $headers, array $rows): string
    {
        $xml  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $xml .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
        $xml .= '<sheetData>';

        // Row 1 — header (bold, style=1)
        $xml .= '<row r="1">';
        foreach ($headers as $colIdx => $header) {
            $col  = $this->colLetter($colIdx);
            $ref  = $col . '1';
            $cell = htmlspecialchars((string) $header, ENT_XML1, 'UTF-8');
            $xml .= "<c r=\"{$ref}\" t=\"inlineStr\" s=\"1\"><is><t>{$cell}</t></is></c>";
        }
        $xml .= '</row>';

        // Data rows
        foreach ($rows as $rowIdx => $row) {
            $rowNum = $rowIdx + 2;
            $xml   .= "<row r=\"{$rowNum}\">";
            $values = array_values($row);
            foreach ($values as $colIdx => $val) {
                $col = $this->colLetter($colIdx);
                $ref = $col . $rowNum;
                if ($val === null || $val === '') {
                    $xml .= "<c r=\"{$ref}\"/>";
                } elseif (is_numeric($val)) {
                    $xml .= "<c r=\"{$ref}\"><v>" . $val . '</v></c>';
                } else {
                    $cell = htmlspecialchars((string) $val, ENT_XML1, 'UTF-8');
                    $xml .= "<c r=\"{$ref}\" t=\"inlineStr\"><is><t>{$cell}</t></is></c>";
                }
            }
            $xml .= '</row>';
        }

        $xml .= '</sheetData></worksheet>';
        return $xml;
    }

    /** Converte indice colonna (0-based) in lettere: 0→A, 25→Z, 26→AA */
    private function colLetter(int $index): string
    {
        $letter = '';
        $index++;
        while ($index > 0) {
            $mod     = ($index - 1) % 26;
            $letter  = chr(65 + $mod) . $letter;
            $index   = (int) (($index - $mod) / 26);
        }
        return $letter;
    }
}
