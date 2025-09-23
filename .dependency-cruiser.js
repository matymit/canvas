module.exports = {
  options: {
    tsConfig: { fileName: "/home/mason/Projects/Canvas/tsconfig.json" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
    exclude: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      "test-results",
      "__tests__",
      "\\.test\\.",
      "\\.spec\\."
    ]
  }
};


