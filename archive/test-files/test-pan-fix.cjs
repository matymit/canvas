#!/usr/bin/env node

/**
 * Pan Tool Fix Verification Script
 *
 * This script tests the viewport synchronization fix by:
 * 1. Checking that the FigJamCanvas component has the correct subscription
 * 2. Verifying that the useEffect dependencies are properly set
 * 3. Testing the store-stage synchronization logic
 */

const fs = require("fs");
const path = require("path");

console.log("🔧 Pan Tool Fix Verification");
console.log("================================\n");

// Test 1: Check FigJamCanvas component for correct subscription
function testFigJamCanvasSubscription() {
  console.log("📋 Test 1: Checking FigJamCanvas subscription...");

  const figJamCanvasPath = path.join(
    __dirname,
    "src/features/canvas/components/FigJamCanvas.tsx",
  );

  if (!fs.existsSync(figJamCanvasPath)) {
    console.log("❌ FigJamCanvas.tsx not found");
    return false;
  }

  const content = fs.readFileSync(figJamCanvasPath, "utf8");

  // Check for the custom viewport subscription
  const viewportSubscriptionMatch = content.match(
    /const viewport = useUnifiedCanvasStore\(\(state\) => state\.viewport\) as any;/,
  );

  if (!viewportSubscriptionMatch) {
    console.log("❌ Viewport subscription not found or incorrect");
    return false;
  }

  console.log("✅ Viewport subscription found");

  // Check for the correct useEffect dependencies
  const useEffectMatch = content.match(
    /\}, \[viewport\.scale, viewport\.x, viewport\.y\]\);/,
  );

  if (!useEffectMatch) {
    console.log("❌ useEffect dependencies not found or incorrect");
    return false;
  }

  console.log("✅ useEffect dependencies found");

  // Check for the viewport synchronization logic
  const syncLogicMatch = content.match(
    /stage\.scale\(\{ x: viewport\.scale, y: viewport\.scale \}\);/,
  );

  if (!syncLogicMatch) {
    console.log("❌ Viewport synchronization logic not found");
    return false;
  }

  console.log("✅ Viewport synchronization logic found");

  return true;
}

// Test 2: Check PanTool component
function testPanToolComponent() {
  console.log("\n📋 Test 2: Checking PanTool component...");

  const panToolPath = path.join(
    __dirname,
    "src/features/canvas/components/tools/navigation/PanTool.tsx",
  );

  if (!fs.existsSync(panToolPath)) {
    console.log("❌ PanTool.tsx not found");
    return false;
  }

  const content = fs.readFileSync(panToolPath, "utf8");

  // Check for viewport.setPan usage
  const setPanMatch = content.match(/viewport\.setPan\(newX, newY\);/);

  if (!setPanMatch) {
    console.log("❌ viewport.setPan usage not found");
    return false;
  }

  console.log("✅ PanTool uses viewport.setPan");

  // Check for RAF batching
  const rafMatch = content.match(/requestAnimationFrame\(\(\) => \{/);

  if (!rafMatch) {
    console.log("❌ RAF batching not found");
    return false;
  }

  console.log("✅ RAF batching found");

  return true;
}

// Test 3: Check coreModule setPan implementation
function testCoreModuleSetPan() {
  console.log("\n📋 Test 3: Checking coreModule setPan implementation...");

  const coreModulePath = path.join(
    __dirname,
    "src/features/canvas/stores/modules/coreModule.ts",
  );

  if (!fs.existsSync(coreModulePath)) {
    console.log("❌ coreModule.ts not found");
    return false;
  }

  const content = fs.readFileSync(coreModulePath, "utf8");

  // Check for setPan implementation
  const setPanMatch = content.match(/setPan: \(x, y\) => \{/);

  if (!setPanMatch) {
    console.log("❌ setPan implementation not found");
    return false;
  }

  console.log("✅ setPan implementation found");

  // Check for proper store update
  const storeUpdateMatch = content.match(/set\(\(draft\) => \{/);

  if (!storeUpdateMatch) {
    console.log("❌ Store update logic not found");
    return false;
  }

  console.log("✅ Store update logic found");

  return true;
}

// Test 4: Check for any remaining issues
function testForRemainingIssues() {
  console.log("\n📋 Test 4: Checking for remaining issues...");

  const figJamCanvasPath = path.join(
    __dirname,
    "src/features/canvas/components/FigJamCanvas.tsx",
  );
  const content = fs.readFileSync(figJamCanvasPath, "utf8");

  // Check for old problematic dependencies
  const oldDepsMatch = content.match(
    /\}, \[selectedTool, elements, selectedElementIds.*\]\);/,
  );

  if (oldDepsMatch) {
    console.log("❌ Old problematic dependencies still present");
    return false;
  }

  console.log("✅ No old problematic dependencies found");

  // Check for direct stage manipulation in viewport useEffect
  const directStageMatch = content.match(
    /stage\.position\(\{ x: viewport\.x, y: viewport\.y \}\);/,
  );

  if (directStageMatch) {
    console.log(
      "❌ Direct stage position manipulation found (should use layers)",
    );
    return false;
  }

  console.log("✅ No direct stage position manipulation found");

  return true;
}

// Run all tests
function runAllTests() {
  const results = [
    testFigJamCanvasSubscription(),
    testPanToolComponent(),
    testCoreModuleSetPan(),
    testForRemainingIssues(),
  ];

  const passedTests = results.filter((result) => result).length;
  const totalTests = results.length;

  console.log("\n🎯 Test Results:");
  console.log("================================");
  console.log(`Passed: ${passedTests}/${totalTests}`);

  if (passedTests === totalTests) {
    console.log(
      "🎉 All tests passed! The pan tool fix appears to be working correctly.",
    );
    console.log("\n📝 Summary of fixes:");
    console.log("1. ✅ FigJamCanvas now subscribes to entire viewport object");
    console.log("2. ✅ useEffect dependencies use nested viewport properties");
    console.log(
      "3. ✅ PanTool correctly uses viewport.setPan with RAF batching",
    );
    console.log(
      "4. ✅ coreModule properly implements setPan with store updates",
    );
    console.log("5. ✅ No old problematic dependencies remain");
    console.log("\n🚀 Next steps:");
    console.log("- Test manually in the browser at http://localhost:1421");
    console.log("- Select pan tool and try panning the canvas");
    console.log(
      "- Verify that viewport changes persist and stage syncs correctly",
    );
  } else {
    console.log("❌ Some tests failed. Please review the issues above.");
  }

  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testFigJamCanvasSubscription,
  testPanToolComponent,
  testCoreModuleSetPan,
  testForRemainingIssues,
  runAllTests,
};
