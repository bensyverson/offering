import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.10.0";

// Fetch all environment variables
const LISTMONK_BASE_URL = Deno.env.get("LISTMONK_BASE_URL"); // e.g., "https://your-listmonk-domain.com"
const LIST_ID = parseInt(Deno.env.get("LIST_ID"));           // Your Listmonk List ID (string)
const API_USER = Deno.env.get("API_USER");                   // Listmonk API username
const API_KEY = Deno.env.get("API_KEY");                     // Listmonk API key
const TEMPLATE_ID = parseInt(Deno.env.get("TEMPLATE_ID"));   // Listmonk template ID (number)
const FROM_EMAIL = Deno.env.get("FROM_EMAIL");               // Sender email
const DOWNLOAD_URL = Deno.env.get("DOWNLOAD_URL");           // URL of the lead magnet
const MAGNET_ID = Deno.env.get("MAGNET_ID");                 // ID for the lead magnet (e.g., "trend-report")

// Serve the Bunny.net edge function
BunnySDK.net.http.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Invalid request method", { status: 405 });
  }

  // Check if all required environment variables are set
  const missingEnvVars = [];

  if (!LISTMONK_BASE_URL) missingEnvVars.push("LISTMONK_BASE_URL");
  if (!LIST_ID) missingEnvVars.push("LIST_ID");
  if (!API_USER) missingEnvVars.push("LISTMONK_API_USER");
  if (!API_KEY) missingEnvVars.push("LISTMONK_API_KEY");
  if (!TEMPLATE_ID) missingEnvVars.push("TEMPLATE_ID");
  if (!FROM_EMAIL) missingEnvVars.push("FROM_EMAIL");
  if (!DOWNLOAD_URL) missingEnvVars.push("DOWNLOAD_URL");

  if (missingEnvVars.length > 0) {
    return new Response(`Missing environment variables: ${missingEnvVars.join(", ")}`, { status: 500 });
  }

  try {
    // Parse the incoming JSON body
    const body = await request.json();
    const email = body.email;
    const name = body.name;// || "Subscriber"; // Default to "Subscriber" if no name is provided

    if (!email || !name) {
      return new Response("Invalid request: email and name are required", { status: 400 });
    }

    // Step 1: Add subscriber to Listmonk
    const subscriberResponse = await listmonkRequest("/api/subscribers", {
      email,
      name,
      lists: [LIST_ID],
      status: "enabled",
      attribs: {
        "leadMagnet": MAGNET_ID
      }
    });

    if (!subscriberResponse.ok) {
      throw new Error(`Failed to add subscriber: ${await subscriberResponse.text()}}`);
    }

    // Step 2: Send transactional email
    const emailResponse = await listmonkRequest("/api/tx", {
      subscriber_email: email,
      template_id: TEMPLATE_ID,
      from_email: FROM_EMAIL,
      data: {
        name,
        downloadUrl: DOWNLOAD_URL, // Use this to insert the url into the template
      },
    });

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${await emailResponse.text()}`);
    }

    // Success response
    return new Response("Subscription successful, email sent!", { status: 200 });

  } catch (error) {
    console.error("Error:", error);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
});

// Helper function to make authenticated requests to the Listmonk API
async function listmonkRequest(endpoint, data) {
  const url = LISTMONK_BASE_URL + endpoint;

  const response = await fetch(url, {
    method: 'POST',  // POST request
    headers: {
      'Authorization': `token ${API_USER}:${API_KEY}`,  // Authorization header
      'Content-Type': 'application/json',  // Set content type to JSON
    },
    body: JSON.stringify(data),  // Convert data to JSON string
  });

  return response;  // Return the response, which is already a Promise
}
