export default function InstagramSuccess() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">Instagram Login Successful!</h1>
            <p>Your Instagram account has been connected.</p>
            <a href="/" className="mt-4 text-blue-600 underline">
                Go back home
            </a>
        </div>
    );
}

