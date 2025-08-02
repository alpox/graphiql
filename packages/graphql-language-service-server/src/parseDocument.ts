import { extname } from 'node:path';
import type { CachedContent } from 'graphql-language-service';
import { Range, Position } from 'graphql-language-service';
import type { Logger } from './Logger';

import { findGraphQLTags } from './findGraphQLTags';
import {
  DEFAULT_SUPPORTED_EXTENSIONS,
  DEFAULT_SUPPORTED_GRAPHQL_EXTENSIONS,
  SupportedExtensionsEnum,
} from './constants';
import { NoopLogger } from './Logger';
import { gqlPluckFromCodeString } from '@graphql-tools/graphql-tag-pluck';

/**
 * Helper functions to perform requested services from client/server.
 */

const SUPPORTED_PLUCK_EXTENSIONS = [
  `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx`, `.flow`, `.flow.js`, `.flow.jsx`, `.vue`, `.svelte`, `.astro`
]

// Check the uri to determine the file type (JavaScript/GraphQL).
// If .js file, either return the parsed query/range or null if GraphQL queries
// are not found.
export async function parseDocument(
  text: string,
  uri: string,
  fileExtensions: ReadonlyArray<SupportedExtensionsEnum> = DEFAULT_SUPPORTED_EXTENSIONS,
  graphQLFileExtensions: string[] = DEFAULT_SUPPORTED_GRAPHQL_EXTENSIONS,
  logger: Logger | NoopLogger = new NoopLogger(),
): Promise<CachedContent[]> {

  // Check if the text content includes a GraphQL query.
  // If the text doesn't include GraphQL queries, do not proceed.
  const ext = extname(
    uri,
  ) as unknown as (typeof DEFAULT_SUPPORTED_EXTENSIONS)[number];
  if (!text || text === '') {
    return [];
  }

  if (SUPPORTED_PLUCK_EXTENSIONS.includes(ext)) {
    const pluckedResults = await gqlPluckFromCodeString(uri, text, {
      skipIndent: true,
      gqlVueBlock: 'gql',
    })

    if (pluckedResults.length > 0) {
      return pluckedResults.map(({ body, locationOffset }) => {
        const query = body;
        const lines = query.split('\n');
        return {
          query: body,
          range: new Range(
            new Position(locationOffset.line, locationOffset.column),
            new Position(locationOffset.line + lines.length, lines.at(-1)!.length - 1),
          ),
        }
      });
    }
  }

  if (fileExtensions.includes(ext)) {
    const templates = await findGraphQLTags(text, ext, uri, logger);
    return templates.map(({ template, range }) => ({ query: template, range }));
  }
  if (graphQLFileExtensions.includes(ext)) {
    const query = text;
    const lines = query.split('\n');
    const range = new Range(
      new Position(0, 0),
      new Position(lines.length - 1, lines.at(-1)!.length - 1),
    );
    return [{ query, range }];
  }
  return [];
}
