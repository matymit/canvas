import puppeteer from 'puppeteer';

async function testPanToolFunctionality() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI environments
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 50 // Slow down for debugging
  });

  const page = await browser.newPage();

  // Enable console logging
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'log' || type === 'error') {
      console.log(`[BROWSER ${type.toUpperCase()}]: ${text}`);
    }
  });

  try {
    console.log('🚀 Starting pan tool functional validation test...');

    // Navigate to the canvas app
    console.log('📍 Navigating to http://localhost:1420');
    await page.goto('http://localhost:1420', {
      waitUntil: 'networkidle0',
      timeout: 10000
    });

    // Wait for the canvas to be loaded
    console.log('⏳ Waiting for canvas to load...');
    await page.waitForSelector('canvas', { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 2000)); // Additional wait for initialization

    // Look for pan tool button
    console.log('🔍 Looking for pan tool button...');
    const panButton = await page.$('[data-tool="pan"], [aria-label*="pan" i], button[title*="pan" i]');

    if (!panButton) {
      console.log('❌ FAILURE: Pan tool button not found');
      // Try to get all buttons to see what's available
      const allButtons = await page.$$eval('button', buttons =>
        buttons.map(btn => ({ text: btn.textContent, title: btn.title, ariaLabel: btn.ariaLabel }))
      );
      console.log('Available buttons:', allButtons);
    } else {
      console.log('✅ SUCCESS: Pan tool button found');

      // Click the pan tool button
      console.log('🖱️  Clicking pan tool button...');
      await panButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if cursor changes to grab
      const cursorStyle = await page.evaluate(() => {
        const canvasContainer = document.querySelector('canvas')?.parentElement;
        return canvasContainer ? window.getComputedStyle(canvasContainer).cursor : 'not found';
      });

      console.log(`🖱️  Cursor style after pan tool selection: ${cursorStyle}`);

      if (cursorStyle === 'grab') {
        console.log('✅ SUCCESS: Cursor changed to grab');
      } else {
        console.log('❌ FAILURE: Cursor did not change to grab');
      }

      // Test pan operation
      console.log('🖱️  Testing pan operation...');
      const canvas = await page.$('canvas');

      if (canvas) {
        // Get initial viewport state
        const initialState = await page.evaluate(() => {
          const store = window.useUnifiedCanvasStore?.getState();
          return {
            hasStore: !!store,
            viewport: store?.viewport ? { x: store.viewport.x, y: store.viewport.y } : null
          };
        });

        console.log('Initial state:', initialState);

        // Perform drag operation
        const canvasBox = await canvas.boundingBox();
        const startX = canvasBox.x + canvasBox.width / 2;
        const startY = canvasBox.y + canvasBox.height / 2;
        const endX = startX + 100;
        const endY = startY + 50;

        console.log(`🖱️  Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.move(endX, endY, { steps: 10 });
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.up();
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for RAF to complete

        // Check final viewport state
        const finalState = await page.evaluate(() => {
          const store = window.useUnifiedCanvasStore?.getState();
          return {
            hasStore: !!store,
            viewport: store?.viewport ? { x: store.viewport.x, y: store.viewport.y } : null
          };
        });

        console.log('Final state:', finalState);

        // Check if viewport changed
        if (initialState.viewport && finalState.viewport) {
          const deltaX = finalState.viewport.x - initialState.viewport.x;
          const deltaY = finalState.viewport.y - initialState.viewport.y;

          console.log(`🖱️  Viewport delta: (${deltaX}, ${deltaY})`);

          if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            console.log('✅ SUCCESS: Viewport changed - pan operation worked');
          } else {
            console.log('❌ FAILURE: Viewport did not change - pan operation failed');
          }
        } else {
          console.log('❌ FAILURE: Could not read viewport state');
        }
      } else {
        console.log('❌ FAILURE: Canvas element not found');
      }
    }

  } catch (error) {
    console.error('🚨 ERROR during testing:', error.message);
    console.error(error.stack);
  } finally {
    console.log('🔚 Closing browser...');
    await browser.close();
  }
}

// Run the test
testPanToolFunctionality().catch(console.error);