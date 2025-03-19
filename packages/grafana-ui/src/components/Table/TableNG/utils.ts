import { css } from '@emotion/css';
import { Property } from 'csstype';
import React from 'react';
import { SortColumn, SortDirection } from 'react-data-grid';
import tinycolor from 'tinycolor2';

import {
  FieldType,
  Field,
  formattedValueToString,
  reduceField,
  GrafanaTheme2,
  fieldReducers,
  DisplayValue,
  LinkModel,
  DisplayValueAlignmentFactors,
  DataFrame,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  TableAutoCellOptions,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  TableCellHeight,
  TableCellOptions,
} from '@grafana/schema';

import { TableCellInspectorMode } from '../..';
import { getTextColorForAlphaBackground } from '../../../utils';

import { TABLE } from './constants';
import {
  CellColors,
  TableRow,
  TableFieldOptionsType,
  ColumnTypes,
  FilterType,
  FrameToRowsConverter,
  TableNGProps,
  Comparator,
} from './types';

/* ---------------------------- Cell calculations --------------------------- */
export function getCellHeight(
  text: string,
  cellWidth: number, // width of the cell without padding
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding = 0
) {
  const PADDING = padding * 2;

  if (osContext !== null && typeof text === 'string') {
    const words = text.split(/\s/);
    const lines = [];
    let currentLine = '';

    // Let's just wrap the lines and see how well the measurement works
    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];
      // TODO: this method is not accurate
      let lineWidth = osContext.measureText(currentLine + ' ' + currentWord).width;

      // if line width is less than the cell width, add the word to the current line and continue
      // else add the current line to the lines array and start a new line with the current word
      if (lineWidth < cellWidth) {
        currentLine += ' ' + currentWord;
      } else {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });

        currentLine = currentWord;
      }

      // if we are at the last word, add the current line to the lines array
      if (i === words.length - 1) {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });
      }
    }

    if (lines.length === 1) {
      return defaultRowHeight;
    }

    // TODO: double padding to adjust osContext.measureText() results
    const height = lines.length * lineHeight + PADDING * 2;

    return height;
  }

  return defaultRowHeight;
}

export function getDefaultRowHeight(theme: GrafanaTheme2, cellHeight: TableCellHeight | undefined): number {
  const bodyFontSize = theme.typography.fontSize;
  const lineHeight = theme.typography.body.lineHeight;

  switch (cellHeight) {
    case TableCellHeight.Sm:
      return 36;
    case TableCellHeight.Md:
      return 42;
    case TableCellHeight.Lg:
      return TABLE.MAX_CELL_HEIGHT;
  }

  return TABLE.CELL_PADDING * 2 + bodyFontSize * lineHeight;
}

/**
 * getRowHeight determines cell height based on cell width + text length. Used
 * for when textWrap is enabled.
 */
export function getRowHeight(
  row: TableRow,
  columnTypes: ColumnTypes,
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>,
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding: number
): number {
  /**
   * 0. loop through all cells in row
   * 1. find text cell in row
   * 2. find width of text cell
   * 3. calculate height based on width and text length
   * 4. return biggest height
   */

  let biggestHeight = defaultRowHeight;

  for (const key in row) {
    if (isTextCell(key, columnTypes)) {
      if (Object.keys(headerCellRefs.current).length === 0 || !headerCellRefs.current[key]) {
        return biggestHeight;
      }
      const cellWidth = headerCellRefs.current[key].offsetWidth;
      const cellText = String(row[key] ?? '');
      const newCellHeight = getCellHeight(cellText, cellWidth, osContext, lineHeight, defaultRowHeight, padding);

      if (newCellHeight > biggestHeight) {
        biggestHeight = newCellHeight;
      }
    }
  }

  return biggestHeight;
}

export function isTextCell(key: string, columnTypes: Record<string, string>): boolean {
  return columnTypes[key] === FieldType.string;
}

export function shouldTextOverflow(
  key: string,
  row: TableRow,
  columnTypes: ColumnTypes,
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>,
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding: number,
  textWrap: boolean,
  cellInspect: boolean
): boolean {
  if (textWrap || cellInspect) {
    return false;
  }

  if (isTextCell(key, columnTypes)) {
    const cellWidth = headerCellRefs.current[key].offsetWidth;
    const cellText = String(row[key] ?? '');
    const newCellHeight = getCellHeight(cellText, cellWidth, osContext, lineHeight, defaultRowHeight, padding);

    if (newCellHeight > defaultRowHeight) {
      return true;
    }
  }

  return false;
}

export function getColumnWidth(field: Field, fieldConfig: TableNGProps['fieldConfig'], key: string): number {
  const overrideWidth = fieldConfig?.overrides
    ?.find(({ matcher: { id, options } }) => id === 'byName' && options === key)
    ?.properties?.find(({ id }) => id === 'width')?.value;

  return overrideWidth ?? field.config?.custom?.width ?? fieldConfig?.defaults?.custom?.width ?? 'auto';
}

export function getTextAlign(field?: Field): Property.JustifyContent {
  if (!field) {
    return 'flex-start';
  }

  if (field.config.custom) {
    const custom: TableFieldOptionsType = field.config.custom;

    switch (custom.align) {
      case 'right':
        return 'flex-end';
      case 'left':
        return 'flex-start';
      case 'center':
        return 'center';
    }
  }

  if (field.type === FieldType.number) {
    return 'flex-end';
  }

  return 'flex-start';
}

const defaultCellOptions: TableAutoCellOptions = { type: TableCellDisplayMode.Auto };

export function getCellOptions(field: Field): TableCellOptions {
  if (field.config.custom?.displayMode) {
    return migrateTableDisplayModeToCellOptions(field.config.custom?.displayMode);
  }

  if (!field.config.custom?.cellOptions) {
    return defaultCellOptions;
  }

  return field.config.custom.cellOptions;
}

/**
 * Getting gauge or sparkline values to align is very tricky without looking at all values and passing them through display processor.
 * For very large tables that could pretty expensive. So this is kind of a compromise. We look at the first 1000 rows and cache the longest value.
 * If we have a cached value we just check if the current value is longer and update the alignmentFactor. This can obviously still lead to
 * unaligned gauges but it should a lot less common.
 **/
export function getAlignmentFactor(
  field: Field,
  displayValue: DisplayValue,
  rowIndex: number
): DisplayValueAlignmentFactors {
  let alignmentFactor = field.state?.alignmentFactors;

  if (alignmentFactor) {
    // check if current alignmentFactor is still the longest
    if (formattedValueToString(alignmentFactor).length < formattedValueToString(displayValue).length) {
      alignmentFactor = { ...displayValue };
      field.state!.alignmentFactors = alignmentFactor;
    }
    return alignmentFactor;
  } else {
    // look at the next 1000 rows
    alignmentFactor = { ...displayValue };
    const maxIndex = Math.min(field.values.length, rowIndex + 1000);

    for (let i = rowIndex + 1; i < maxIndex; i++) {
      const nextDisplayValue = field.display!(field.values[i]);
      if (formattedValueToString(alignmentFactor).length > formattedValueToString(nextDisplayValue).length) {
        alignmentFactor.text = displayValue.text;
      }
    }

    if (field.state) {
      field.state.alignmentFactors = alignmentFactor;
    } else {
      field.state = { alignmentFactors: alignmentFactor };
    }

    return alignmentFactor;
  }
}

export interface FooterItem {
  [reducerId: string]: {
    value: string;
    formattedValue: string;
    reducerName: string;
  };
}

/* ------------------------------ Footer calculations ------------------------------ */
export function getFooterItemNG(rows: TableRow[], field: Field): FooterItem | null {
  if (field.type !== FieldType.number) {
    return null;
  }

  const reducers: string[] = field.config.custom?.footer?.reducer ?? [];
  if (!reducers || reducers.length === 0) {
    return null;
  }

  // Calculate all specified reducers
  const results = reduceField({
    field: {
      ...field,
      values: rows.map((row) => row[field.name]),
    },
    reducers,
  });

  // Create an object with reducer names as keys and their formatted values
  const footerItem: FooterItem = {};

  reducers.forEach((reducerId: string) => {
    if (results[reducerId] !== undefined) {
      const value = results[reducerId];
      const reducerName = fieldReducers.get(reducerId)?.name || reducerId;
      const formattedValue = field.display ? formattedValueToString(field.display(value)) : String(value);

      footerItem[reducerId] = {
        value,
        formattedValue,
        reducerName,
      };
    }
  });

  return Object.keys(footerItem).length > 0 ? footerItem : null;
}

export const getFooterStyles = (theme: GrafanaTheme2) => ({
  footerCell: css({
    border: `1px solid ${theme.colors.border.medium}`,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: theme.spacing(1),
    width: '100%',
  }),
  footerItem: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  }),
  footerItemLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightLight,
    marginRight: theme.spacing(1),
    textTransform: 'uppercase',
  }),
  footerItemValue: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
});

/* ------------------------- Cell color calculation ------------------------- */
const CELL_COLOR_DARKENING_MULTIPLIER = 10;
const CELL_GRADIENT_DARKENING_MULTIPLIER = 15;
const CELL_GRADIENT_HUE_ROTATION_DEGREES = 5;

export function getCellColors(
  theme: GrafanaTheme2,
  cellOptions: TableCellOptions,
  displayValue: DisplayValue
): CellColors {
  // Convert RGBA hover color to hex to prevent transparency issues on cell hover
  const autoCellBackgroundHoverColor = convertRGBAToHex(theme.colors.background.primary, theme.colors.action.hover);

  // How much to darken elements depends upon if we're in dark mode
  const darkeningFactor = theme.isDark ? 1 : -0.7;

  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;
  let bgHoverColor: string = autoCellBackgroundHoverColor;

  if (cellOptions.type === TableCellDisplayMode.ColorText) {
    textColor = displayValue.color;
  } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
    const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;

    if (mode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
      bgHoverColor = tinycolor(displayValue.color)
        .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
        .toRgbString();
    } else if (mode === TableCellBackgroundDisplayMode.Gradient) {
      const hoverColor = tinycolor(displayValue.color)
        .darken(CELL_GRADIENT_DARKENING_MULTIPLIER * darkeningFactor)
        .toRgbString();
      const bgColor2 = tinycolor(displayValue.color)
        .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
        .spin(CELL_GRADIENT_HUE_ROTATION_DEGREES);
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
      bgHoverColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${hoverColor})`;
    }
  }

  return { textColor, bgColor, bgHoverColor };
}

/** Extracts numeric pixel value from theme spacing */
export const extractPixelValue = (spacing: string | number): number => {
  return typeof spacing === 'number' ? spacing : parseFloat(spacing) || 0;
};

/** Converts an RGBA color to hex by blending it with a background color */
export const convertRGBAToHex = (backgroundColor: string, rgbaColor: string): string => {
  const bg = tinycolor(backgroundColor);
  const rgba = tinycolor(rgbaColor);
  return tinycolor.mix(bg, rgba, rgba.getAlpha() * 100).toHexString();
};

/* ------------------------------- Data links ------------------------------- */
/**
 * @internal
 */
export const getCellLinks = (field: Field, rowIdx: number) => {
  let links: Array<LinkModel<unknown>> | undefined;
  if (field.getLinks) {
    links = field.getLinks({
      valueRowIndex: rowIdx,
    });
  }

  if (!links) {
    return;
  }

  for (let i = 0; i < links?.length; i++) {
    if (links[i].onClick) {
      const origOnClick = links[i].onClick;

      links[i].onClick = (event) => {
        // Allow opening in new tab
        if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault();
          origOnClick!(event, {
            field,
            rowIndex: rowIdx,
          });
        }
      };
    }
  }

  return links;
};

/* ----------------------------- Data grid sorting ---------------------------- */
export const handleSort = (
  columnKey: string,
  direction: SortDirection,
  isMultiSort: boolean,
  setSortColumns: React.Dispatch<React.SetStateAction<readonly SortColumn[]>>,
  sortColumnsRef: React.MutableRefObject<readonly SortColumn[]>
) => {
  let currentSortColumn: SortColumn | undefined;

  const updatedSortColumns = sortColumnsRef.current.filter((column) => {
    const isCurrentColumn = column.columnKey === columnKey;
    if (isCurrentColumn) {
      currentSortColumn = column;
    }
    return !isCurrentColumn;
  });

  // sorted column exists and is descending -> remove it to reset sorting
  if (currentSortColumn && currentSortColumn.direction === 'DESC') {
    setSortColumns(updatedSortColumns);
    sortColumnsRef.current = updatedSortColumns;
  } else {
    // new sort column or changed direction
    if (isMultiSort) {
      setSortColumns([...updatedSortColumns, { columnKey, direction }]);
      sortColumnsRef.current = [...updatedSortColumns, { columnKey, direction }];
    } else {
      setSortColumns([{ columnKey, direction }]);
      sortColumnsRef.current = [{ columnKey, direction }];
    }
  }
};

/* ----------------------------- Data grid mapping ---------------------------- */
export const frameToRecords = (frame: DataFrame): TableRow[] => {
  const fnBody = `
    const rows = Array(frame.length);
    const values = frame.fields.map(f => f.values);
    let rowCount = 0;
    for (let i = 0; i < frame.length; i++) {
      rows[rowCount] = {
        __depth: 0,
        __index: i,
        ${frame.fields.map((field, fieldIdx) => `${JSON.stringify(field.name)}: values[${fieldIdx}][i]`).join(',')}
      };
      rowCount += 1;
      if (rows[rowCount-1]['Nested frames']){
        const childFrame = rows[rowCount-1]['Nested frames'];
        rows[rowCount] = {__depth: 1, __index: i, data: childFrame[0]}
        rowCount += 1;
      }
    }
    return rows;
  `;

  // Creates a function that converts a DataFrame into an array of TableRows
  // Uses new Function() for performance as it's faster than creating rows using loops
  const convert = new Function('frame', fnBody) as unknown as FrameToRowsConverter;
  return convert(frame);
};

export interface MapFrameToGridOptions extends TableNGProps {
  columnTypes: ColumnTypes;
  columnWidth: number | string;
  crossFilterOrder: React.MutableRefObject<string[]>;
  crossFilterRows: React.MutableRefObject<{ [key: string]: TableRow[] }>;
  defaultLineHeight: number;
  defaultRowHeight: number;
  expandedRows: number[];
  filter: FilterType;
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  osContext: OffscreenCanvasRenderingContext2D | null;
  rows: TableRow[];
  sortedRows: TableRow[];
  setContextMenuProps: (props: { value: string; top?: number; left?: number; mode?: TableCellInspectorMode }) => void;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  setIsInspecting: (isInspecting: boolean) => void;
  setSortColumns: React.Dispatch<React.SetStateAction<readonly SortColumn[]>>;
  sortColumnsRef: React.MutableRefObject<readonly SortColumn[]>;
  styles: { cell: string };
  textWrap: boolean;
  theme: GrafanaTheme2;
}

/* ----------------------------- Data grid comparator ---------------------------- */
const compare = new Intl.Collator('en', { sensitivity: 'base' }).compare;
export function getComparator(sortColumnType: FieldType): Comparator {
  switch (sortColumnType) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
      return (a, b) => {
        if (a === b) {
          return 0;
        }
        if (a == null) {
          return -1;
        }
        if (b == null) {
          return 1;
        }
        return Number(a) - Number(b);
      };
    case FieldType.string:
    case FieldType.enum:
    default:
      return (a, b) => compare(String(a ?? ''), String(b ?? ''));
  }
}

/* ---------------------------- Miscellaneous ---------------------------- */
/**
 * Migrates table cell display mode to new object format.
 *
 * @param displayMode The display mode of the cell
 * @returns TableCellOptions object in the correct format
 * relative to the old display mode.
 */
export function migrateTableDisplayModeToCellOptions(displayMode: TableCellDisplayMode): TableCellOptions {
  switch (displayMode) {
    // In the case of the gauge we move to a different option
    case 'basic':
    case 'gradient-gauge':
    case 'lcd-gauge':
      let gaugeMode = BarGaugeDisplayMode.Basic;

      if (displayMode === 'gradient-gauge') {
        gaugeMode = BarGaugeDisplayMode.Gradient;
      } else if (displayMode === 'lcd-gauge') {
        gaugeMode = BarGaugeDisplayMode.Lcd;
      }

      return {
        type: TableCellDisplayMode.Gauge,
        mode: gaugeMode,
      };
    // Also true in the case of the color background
    case 'color-background':
    case 'color-background-solid':
      let mode = TableCellBackgroundDisplayMode.Basic;

      // Set the new mode field, somewhat confusingly the
      // color-background mode is for gradient display
      if (displayMode === 'color-background') {
        mode = TableCellBackgroundDisplayMode.Gradient;
      }

      return {
        type: TableCellDisplayMode.ColorBackground,
        mode: mode,
      };
    default:
      return {
        // @ts-ignore
        type: displayMode,
      };
  }
}

/** Returns true if the DataFrame contains nested frames */
export const getIsNestedTable = (dataFrame: DataFrame): boolean =>
  dataFrame.fields.some(({ type }) => type === FieldType.nestedFrames);

// Get the maximum number of reducers across all fields
const getMaxReducerCount = (dataFrame: DataFrame, fieldConfig: TableNGProps['fieldConfig']): number => {
  // Filter to only numeric fields that can have reducers
  const numericFields = dataFrame.fields.filter(({ type }) => type === FieldType.number);

  // If there are no numeric fields, return 0
  if (numericFields.length === 0) {
    return 0;
  }

  // Map each field to its reducer count (direct config or override)
  const reducerCounts = numericFields.map((field) => {
    // Get the direct reducer count from the field config
    const directReducers = field.config?.custom?.footer?.reducer ?? [];
    let reducerCount = directReducers.length;

    // Check for overrides if field config is available
    if (fieldConfig?.overrides) {
      // Find override that matches this field
      const override = fieldConfig.overrides.find(
        ({ matcher: { id, options } }) => id === 'byName' && options === field.name
      );

      // Check if there's a footer reducer property in the override
      const footerProperty = override?.properties?.find(({ id }) => id === 'custom.footer.reducer');
      if (footerProperty?.value && Array.isArray(footerProperty.value)) {
        // If override exists, it takes precedence over direct config
        reducerCount = footerProperty.value.length;
      }
    }

    return reducerCount;
  });

  // Return the maximum count or 0 if no reducers found
  return reducerCounts.length > 0 ? Math.max(...reducerCounts) : 0;
};

// Calculate the footer height based on the maximum reducer count
export const calculateFooterHeight = (dataFrame: DataFrame, fieldConfig: TableNGProps['fieldConfig']) => {
  const maxReducerCount = getMaxReducerCount(dataFrame, fieldConfig);
  // Base height (+ padding) + height per reducer
  const dynamicHeight = 36 + maxReducerCount * 22;
  return Math.max(dynamicHeight, 36); // Ensure minimum height of 36px
};
