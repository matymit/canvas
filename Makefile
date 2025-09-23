DEP_DIR=.dependency-cache

.PHONY: deps-src deps-canvas deps-focused-src deps-focused-canvas deps-all-src deps-all-canvas

deps-src:
	npm run deps:json:src
	npm run deps:dot:src
	npm run deps:svg:src
	npm run deps:metrics:src

deps-canvas:
	npm run deps:json:canvas
	npm run deps:dot:canvas
	npm run deps:svg:canvas
	npm run deps:metrics:canvas

deps-focused-src:
	npm run deps:edges:src
	npm run deps:focused:src

deps-focused-canvas:
	npm run deps:edges:canvas
	npm run deps:focused:canvas

deps-all-src: deps-src deps-focused-src

deps-all-canvas: deps-canvas deps-focused-canvas


