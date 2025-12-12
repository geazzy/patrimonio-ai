import { Asset } from '../types';

/**
 * Helper to determine category based on description keywords.
 */
const determineCategory = (description: string): string => {
  const d = description.toUpperCase();
  if (d.includes('COMPUTADOR') || d.includes('CPU') || d.includes('NOTEBOOK') || d.includes('SERVER') || d.includes('SERVIDOR')) return 'Informática';
  if (d.includes('MONITOR') || d.includes('TELA') || d.includes('PROJETOR')) return 'Audiovisual';
  if (d.includes('CADEIRA') || d.includes('MESA') || d.includes('BANCADA') || d.includes('ESTANTE') || d.includes('ARMÁRIO') || d.includes('RACK')) return 'Mobiliário';
  if (d.includes('IMPRESSORA') || d.includes('SCANNER')) return 'Periféricos';
  if (d.includes('VEÍCULO') || d.includes('CARRO')) return 'Veículo';
  return 'Outros';
};

/**
 * Parses raw OCR string data into structured Asset objects.
 * Handles the specific format provided in the screenshots:
 * Header section with "Responsável" -> multiple lines of items.
 */
export const parseOCRData = (text: string): Asset[] => {
  const lines = text.split('\n');
  const assets: Asset[] = [];
  
  let currentResponsible = 'Unknown';
  let currentSector = 'Unknown';
  
  // Regex to match the Asset Line:
  // Starts with Digits (Tombo), then Description, then R$ Value, then Term/Date, then Location
  // Example: 351965 BANCADA ... MADEIR R$5,05 210505-04/01/2018 PROTLAB
  const assetLineRegex = /^\s*(\d+)\s+(.+?)\s+(R\$\s?[\d.,]+)\s+(\S+)\s+(.+)$/;
  
  // Regex to find Responsible
  const responsibleRegex = /^Responsável:\s+(.+)$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for context change (Responsible person)
    const respMatch = trimmedLine.match(responsibleRegex);
    if (respMatch) {
      currentResponsible = respMatch[1].trim();
      continue;
    }

    // Check for Asset Data
    const assetMatch = trimmedLine.match(assetLineRegex);
    if (assetMatch) {
      const [_, id, description, valueStr, termDate, location] = assetMatch;
      
      // Parse Value (remove R$, replace comma with dot)
      const numericValue = parseFloat(
        valueStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
      );

      const descTrimmed = description.trim();

      assets.push({
        id,
        description: descTrimmed,
        value: isNaN(numericValue) ? 0 : numericValue,
        valueFormatted: valueStr.trim(),
        termDate: termDate.trim(),
        location: location.trim(),
        responsible: currentResponsible,
        sector: currentSector, // Currently empty in OCR, but field exists in structure
        category: determineCategory(descTrimmed),
        tags: [],
        history: []
      });
    }
  }

  return assets;
};