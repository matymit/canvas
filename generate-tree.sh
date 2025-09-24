#!/bin/bash

# Generate tree structure of src folder excluding noise files
# Output to src-tree.txt in project root

OUTPUT_FILE="src-tree.txt"

echo "Generating src folder tree structure..."

# Use tree command with exclusions for common noise files/folders
tree src \
  -I 'node_modules|*.log|*.tmp|*.cache|.git|.DS_Store|Thumbs.db|*.swp|*.swo|*~|.vscode|.idea|dist|build|coverage|.nyc_output|*.map|*.min.js|*.min.css' \
  -a \
  --dirsfirst \
  --charset=ascii \
  > "$OUTPUT_FILE"

echo "Tree structure exported to $OUTPUT_FILE"
echo "File size: $(wc -l < "$OUTPUT_FILE") lines"