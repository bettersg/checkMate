.PHONY: firebase
firebase:
	npm run serve

.PHONY: checkers-app
checkers-app:
	cd checkers-app && npm run build:watch

.PHONY: functions
functions:
	cd functions && npm run build:watch