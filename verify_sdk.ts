import { Account, InternalWorlds } from "./sdk.ts";

// Mock fetch to prevent actual network calls
globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> => {
    const url = input.toString();
    console.log(`Fetch called: ${init?.method || "GET"} ${url}`);

    if (url.endsWith("/key/rotate") && init?.method === "POST") {
        return new Response(
            JSON.stringify({
                id: "acc_123",
                apiKey: "sk_new_key",
                description: "mock account",
                plan: "free_plan",
                accessControl: { worlds: [] },
            } as Account),
            { status: 200 },
        );
    }

    if (url.endsWith("/key") && init?.method === "DELETE") {
        return new Response(null, { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
};

async function testSdk() {
    const internalClient = new InternalWorlds({
        baseUrl: "http://localhost:8000",
        apiKey: "sk_admin",
    });

    console.log("Testing rotateAccountKey...");
    const newAccount = await internalClient.rotateAccountKey("acc_123");
    console.log(
        "Rotate Result:",
        newAccount.apiKey === "sk_new_key" ? "PASS" : "FAIL",
    );

    console.log("Testing revokeAccountKey...");
    try {
        await internalClient.revokeAccountKey("acc_123");
        console.log("Revoke Result: PASS");
    } catch (e) {
        console.error("Revoke Result: FAIL", e);
    }
}

testSdk();
