# Pine Script v6 Gap Analysis Report

This document identifies gaps between the current `pineDocs.json` documentation file and the official Pine Script v6 documentation from TradingView.

## Executive Summary

The extension's documentation (`Pine_Script_Documentation/pineDocs.json`) is currently based on **Pine Script v5**, with **574 references to version 5** and **0 references to version 6**. Several key v6 features are missing or incomplete.

## Identified Gaps

### 1. Version References (CRITICAL)
- **Status**: ❌ All examples use `//@version=5`
- **Impact**: Users won't see v6-specific syntax and features in code examples
- **Fix Required**: Update all example code from `//@version=5` to `//@version=6`

### 2. Text Formatting Parameter (HIGH PRIORITY)
- **Status**: ❌ Missing from both `label.new()` and `box.new()`
- **Current State**: 
  - `label.new` arguments: `['x', 'y', 'text', 'xloc', 'yloc', 'color', 'style', 'textcolor', 'size', 'textalign', 'tooltip', 'text_font_family', 'point']`
  - `box.new` arguments: `['left', 'top', 'right', 'bottom', 'border_color', 'border_width', 'border_style', 'extend', 'xloc', 'bgcolor', 'text', 'text_size', 'text_font_family', 'text_color', 'text_halign', 'text_valign', 'text_wrap', 'top_left', 'bottom_right']`
- **Missing**: `text_formatting` parameter for combining `text.format_bold`, `text.format_italic`, etc.
- **v6 Feature**: Allows combining formatting like `text.format_bold + text.format_italic`

### 3. Exact Text Sizes (MEDIUM PRIORITY)
- **Status**: ⚠️ Only size.* constants documented
- **Current Constants**: `['size.auto', 'size.tiny', 'size.small', 'size.normal', 'size.large', 'size.huge']`
- **v6 Feature**: Numeric point sizes (e.g., `text_size = 16`) instead of just predefined constants
- **Fix Required**: Document that `text_size` accepts both constants AND numeric values

### 4. Negative Array Indices (HIGH PRIORITY)
- **Status**: ❌ Not documented
- **Current Documentation**: "The index of the element whose value is to be returned."
- **v6 Feature**: `array.get(myArray, -1)` returns last element, `-2` returns second-to-last, etc.
- **Fix Required**: Update `array.get()` description to mention negative index support

### 5. Dynamic Symbol Requests (HIGH PRIORITY)
- **Status**: ❌ Not documented
- **Current Documentation**: No mention of dynamic symbols or loop usage
- **v6 Feature**: `request.security()` can now use dynamic symbols in loops:
  ```pine
  symbols = array.from("AAPL", "GOOGL", "MSFT")
  for symbol in symbols
      price = request.security(symbol, "1D", close)
  ```
- **Fix Required**: Update `request.security()` to document dynamic symbol support

### 6. Short-Circuit Evaluation (MEDIUM PRIORITY)
- **Status**: ❌ Not documented
- **v6 Feature**: Boolean operators `and`/`or` now use short-circuit evaluation:
  ```pine
  if array.size(myArray) > 0 and array.first(myArray) > 0
      // array.first() only evaluated if size > 0
  ```
- **Fix Required**: Add documentation for boolean operator behavior

### 7. Strategy Order Trimming (LOW PRIORITY)
- **Status**: ⚠️ Strategy functions exist but trimming behavior not documented
- **v6 Feature**: Strategies no longer error at 9000 trades; automatically trim oldest orders
- **Fix Required**: Add remarks to strategy.order* functions about automatic trimming

## Documentation Coverage Statistics

| Category | Count |
|----------|-------|
| Functions | 470 |
| Methods | 192 |
| Constants | 196 |
| Types | 56 |
| **Total** | **914** |

## Text Format Constants (Present ✅)

The following constants ARE documented:
- `text.format_bold` - Bold text formatting constant
- `text.format_italic` - Italic text formatting constant
- `text.align_*` - Text alignment constants

## Recommendations

### Immediate Actions (Required for v6 Support)

1. **Update Version Declarations**
   - Replace all `//@version=5` with `//@version=6` in examples
   - Add migration notes for v5→v6 changes

2. **Add text_formatting Parameter**
   - Update `label.new()` signature to include `text_formatting` parameter
   - Update `box.new()` signature to include `text_formatting` parameter
   - Add examples showing combined formatting

3. **Document Numeric Text Sizes**
   - Update `size` parameter descriptions to mention numeric point values
   - Add examples: `text_size = 16`, `text_size = 14`, etc.

4. **Update array.get() Documentation**
   - Modify index parameter description: "The index of the element (supports negative indices for reverse access)"
   - Add examples with negative indices

5. **Update request.security() Documentation**
   - Add note about dynamic symbol support in loops
   - Include example with array iteration
   - Mention any limitations or best practices

6. **Add Short-Circuit Evaluation Notes**
   - Document boolean operator behavior in language operators section
   - Provide optimization examples

### Secondary Actions

7. **Strategy Function Updates**
   - Add remarks about automatic order trimming at 9000 trade limit
   - Update any error condition documentation

8. **Add v6-Specific Examples**
   - Create new examples showcasing v6 features
   - Keep some v5 examples for backward compatibility reference

## Files Requiring Updates

- `/workspace/Pine_Script_Documentation/pineDocs.json` - Main documentation file
- Potentially `/workspace/src/PineCompletionProvider.ts` - If completion logic needs adjustment
- Potentially `/workspace/src/PineHoverProvider/` - If hover information needs updates

## Testing Recommendations

After updates:
1. Test completions for `text_formatting` parameter
2. Verify hover docs show negative index support
3. Confirm `request.security()` shows dynamic symbol examples
4. Check that version 6 examples render correctly

## References

- Official Pine Script v6 Reference: https://www.tradingview.com/pine-script-reference/v6/
- Official Pine Script Docs: https://www.tradingview.com/pine-script-docs
- Test file with v6 features: `/workspace/test-v6-features.pine`

---
*Generated: Analysis of pineDocs.json vs TradingView Pine Script v6 documentation*
