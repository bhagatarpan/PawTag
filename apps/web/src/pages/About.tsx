export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">About PawTag</h1>
      <div className="prose prose-gray max-w-none">
        <p className="text-lg text-gray-600 mb-4">
          PawTag is a New Zealand company dedicated to pet safety and reunification.
        </p>
        <p className="text-gray-600 mb-4">
          Every year, thousands of pets go missing in New Zealand. Traditional ID tags can fall off or become
          unreadable. PawTag solves this problem with durable, scannable QR code tags that link directly to
          your pet's online profile.
        </p>
        <p className="text-gray-600 mb-4">
          When someone finds your pet, they simply scan the QR code with their smartphone camera. No app
          download required. They see your pet's photo, name, and medical alerts, and can notify you
          immediately with their location.
        </p>
        <h2 className="text-2xl font-bold mt-8 mb-4">Our Mission</h2>
        <p className="text-gray-600">
          To make pet recovery fast, simple, and reliable. We believe every pet deserves a safe way home.
        </p>
      </div>
    </div>
  );
}
