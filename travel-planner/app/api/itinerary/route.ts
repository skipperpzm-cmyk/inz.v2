// App Router API route handler (no NextApiRequest/Response)
export async function GET() {
    // TODO: implement GET handler using repository layer
    return new Response(JSON.stringify({ message: 'Itinerary API endpoint' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}