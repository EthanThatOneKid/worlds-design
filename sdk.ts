/**
 * Account represents a service account.
 */
export interface Account {
  /**
   * id is the unique ID of the account.
   */
  id: string;

  /**
   * apiKey is the secret key used to authenticate the account.
   */
  apiKey: string;

  /**
   * description is a user-defined description of the account.
   */
  description: string;

  /**
   * plan is the plan the account is on.
   */
  plan: AccountPlan;

  /**
   * accessControl is the access control list of resources for the account.
   */
  accessControl: AccountAccessControl;
}

/**
 * AccountPlan is the plan the account is on.
 */
export type AccountPlan = "free_plan" | "pro_plan";

/**
 * AccountAccessControl is the access control list of resources for an account.
 */
export interface AccountAccessControl {
  /**
   * worlds is a list of world IDs this account has access to.
   */
  worlds: string[];
}

/**
 * AccountUsageSummary is a summary of usage for an account. The system
 * manages this summary automatically enabling quick access to usage data.
 */
export interface AccountUsageSummary {
  worlds: {
    [worldId: string]: WorldUsageSummary;
  };
}

/**
 * WorldMetadata represents the metadata of a world.
 */
export interface WorldMetadata {
  worldId: string;
  accountId: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  isPublic: boolean;
}

/**
 * WorldUsageSummary is a summary of usage for a world. The system
 * manages this summary automatically enabling quick access to usage data.
 */
export interface WorldUsageSummary {
  /**
   * reads is the total number of reads associated with the world.
   */
  reads: number;

  /**
   * writes is the total number of writes associated with the world.
   */
  writes: number;

  /**
   * queries is the total number of queries associated with the world.
   */
  queries: number;

  /**
   * updates is the total number of updates associated with the world.
   */
  updates: number;

  /**
   * updatedAt is the Unix timestamp in milliseconds the world was last updated.
   */
  updatedAt: number;
}

/**
 * AccountUsageEvent is a log entry for an event associated with an account.
 */
export interface AccountUsageEvent {
  /**
   * id is the unique ID of the event.
   */
  id: string;

  /**
   * accountId is the ID of the account associated with the event.
   */
  accountId: string;

  /**
   * timestamp is the Unix timestamp in milliseconds of the event.
   */
  timestamp: number;

  /**
   * endpoint is the method and pathname the event occurred on.
   */
  endpoint: AccountUsageEventEndpoint;

  /**
   * params is the parameters associated with the event.
   */
  params: Record<string, string>;

  /**
   * statusCode is the HTTP status code of the event.
   */
  statusCode: number;
}

/**
 * AccountUsageEventEndpoint is a valid HTTP method and pathname.
 */
export type AccountUsageEventEndpoint =
  | "GET /worlds/{worldId}"
  | "POST /worlds/{worldId}"
  | "PUT /worlds/{worldId}"
  | "PATCH /worlds/{worldId}"
  | "DELETE /worlds/{worldId}"
  | "GET /worlds/{worldId}/sparql"
  | "POST /worlds/{worldId}/sparql";

/**
 * isAccount checks if the object is an Account.
 */
export function isAccount(obj: unknown): obj is Account {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const account = obj as Account;

  if (typeof account.id !== "string") {
    return false;
  }

  if (typeof account.apiKey !== "string") {
    return false;
  }

  if (typeof account.description !== "string") {
    return false;
  }

  if (account.plan !== "free_plan" && account.plan !== "pro_plan") {
    return false;
  }

  if (
    typeof account.accessControl !== "object" ||
    account.accessControl === null
  ) {
    return false;
  }

  if (!Array.isArray(account.accessControl.worlds)) {
    return false;
  }

  if (account.accessControl.worlds.some((w) => typeof w !== "string")) {
    return false;
  }

  return true;
}

/**
 * WorldsOptions are the options for the Worlds API SDK.
 */
export interface WorldsOptions {
  baseUrl: string;
  apiKey: string;
}

/**
 * Worlds is a TypeScript SDK for the Worlds API.
 */
export class Worlds {
  public constructor(
    public readonly options: WorldsOptions,
  ) {}

  /**
   * getWorld gets a world from the Worlds API.
   */
  public async getWorld(
    worldId: string,
    encoding: string,
  ): Promise<string | null> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}`,
      {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Accept": encoding,
        },
      },
    );
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  }

  /**
   * setWorld sets a world in the Worlds API.
   */
  public async setWorld(
    worldId: string,
    world: string,
    encoding: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": encoding,
        },
        body: world,
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * addQuads adds quads to a world in the Worlds API.
   */
  public async addQuads(
    worldId: string,
    data: string,
    encoding: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": encoding,
        },
        body: data,
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * removeWorld removes a world from the Worlds API.
   */
  public async removeWorld(worldId: string): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * queryWorld executes a SPARQL query against a world in the Worlds API.
   * Uses POST with application/sparql-query for robustness.
   */
  public async queryWorld(
    worldId: string,
    query: string,
    // deno-lint-ignore no-explicit-any
  ): Promise<any> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}/sparql`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/sparql-query",
          "Accept": "application/sparql-results+json",
        },
        body: query,
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json;
  }

  /**
   * updateWorld executes a SPARQL update against a world in the Worlds API.
   */
  public async updateWorld(
    worldId: string,
    update: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}/sparql`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/sparql-update",
        },
        body: update,
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * updateMetadata updates the metadata of a world.
   */
  public async updateMetadata(
    worldId: string,
    metadata: WorldMetadata,
  ): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/worlds/${worldId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
}

/**
 * World is a TypeScript SDK for a World in the Worlds API.
 */
export class World {
  private readonly worlds: Worlds;

  public constructor(
    public readonly options: WorldsOptions & { worldId: string },
  ) {
    this.worlds = new Worlds(options);
  }

  /**
   * get gets the world.
   */
  public get(encoding: string): Promise<string | null> {
    return this.worlds.getWorld(this.options.worldId, encoding);
  }

  /**
   * set sets the world.
   */
  public set(world: string, encoding: string): Promise<void> {
    return this.worlds.setWorld(this.options.worldId, world, encoding);
  }

  /**
   * addQuads adds quads to the world.
   */
  public addQuads(data: string, encoding: string): Promise<void> {
    return this.worlds.addQuads(this.options.worldId, data, encoding);
  }

  /**
   * remove removes the world.
   */
  public remove(): Promise<void> {
    return this.worlds.removeWorld(this.options.worldId);
  }

  /**
   * query executes a SPARQL query against the world.
   */
  // deno-lint-ignore no-explicit-any
  public query(query: string): Promise<any> {
    return this.worlds.queryWorld(this.options.worldId, query);
  }

  /**
   * update executes a SPARQL update against the world.
   */
  public update(update: string): Promise<void> {
    return this.worlds.updateWorld(this.options.worldId, update);
  }

  /**
   * updateMetadata updates the world's metadata.
   */
  public updateMetadata(metadata: WorldMetadata): Promise<void> {
    return this.worlds.updateMetadata(
      this.options.worldId,
      metadata,
    );
  }
}

/**
 * InternalWorlds is a TypeScript SDK for internal/owner-only operations
 * on the Worlds API.
 */
export class InternalWorlds extends Worlds {
  public constructor(options: WorldsOptions) {
    super(options);
  }

  /**
   * createAccount creates a new account in the Worlds API.
   */
  public async createAccount(account: Account): Promise<Account> {
    const response = await fetch(`${this.options.baseUrl}/accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(account),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * getAccount retrieves an account from the Worlds API.
   */
  public async getAccount(accountId: string): Promise<Account | null> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${accountId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      },
    );
    if (!response.ok) {
      // Return null if the account does not exist.
      if (response.status === 404) {
        return null;
      }

      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * updateAccount updates an existing account in the Worlds API.
   */
  public async updateAccount(account: Account): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${account.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(account),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * removeAccount removes an account from the Worlds API.
   */
  public async removeAccount(accountId: string): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${accountId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * getWorldsByAccount retrieves the worlds owned by a specific account.
   * This is an admin-only operation.
   */
  public async getWorldsByAccount(
    accountId: string,
  ): Promise<WorldMetadata[]> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${accountId}/worlds`,
      {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * listAccounts retrieves all accounts from the Worlds API.
   * This is an admin-only operation.
   */
  public async listAccounts(): Promise<Account[]> {
    const response = await fetch(`${this.options.baseUrl}/accounts`, {
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
  /**
   * rotateAccountKey rotates the API key for an account.
   */
  public async rotateAccountKey(accountId: string): Promise<Account> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${accountId}/key/rotate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * revokeAccountKey revokes the API key for an account.
   */
  public async revokeAccountKey(accountId: string): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${accountId}/key`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
}
