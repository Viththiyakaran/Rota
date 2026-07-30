/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fuel: {
          ink: "#101735",
          green: "#146ef5",
          deep: "#0b1238",
          lime: "#dcebff",
          mist: "#eef4ff",
          line: "#dde3ee",
          cream: "#f4f6fa",
          gold: "#f59e0b"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(16, 23, 53, 0.06)",
        lift: "0 18px 44px rgba(16, 23, 53, 0.14)"
      }
    }
  },
  plugins: []
};
