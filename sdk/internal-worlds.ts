import { WorldMetadata, WorldsAccount } from "./types/mod.ts";
import { Worlds, WorldsOptions } from "./worlds.ts";

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
  public async createAccount(account: WorldsAccount): Promise<WorldsAccount> {
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
  public async getAccount(accountId: string): Promise<WorldsAccount | null> {
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
  public async updateAccount(account: WorldsAccount): Promise<void> {
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
  public async listAccounts(): Promise<WorldsAccount[]> {
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
  public async rotateAccountKey(accountId: string): Promise<WorldsAccount> {
    const response = await fetch(
      `${this.options.baseUrl}/accounts/${accountId}/rotate`,
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
}
