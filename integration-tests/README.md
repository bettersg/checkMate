# Integration tests

## Postman

To run tests locally:

- Import the collection `checkmate.postman_collection.json` to Postman
- Update `env.json` with `npm run update-env`
- Import the environment `env.json` to Postman
- If there were packages added, run `docker-compose build`
- Run `docker-compose up`
- Change directory to `functions`. Run `npm run build:watch`
- In Postman, run the whole imported collection. Remember to use the "Save responses" option for better debugging.

Note:

- In Github Actions, `npm run update-env` is always run when testing.
