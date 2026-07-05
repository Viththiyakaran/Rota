/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fuel: {
          ink: "#0f172a",
          green: "#047857",
          deep: "#065f46",
          lime: "#d9f99d",
          mist: "#ecfdf5",
          line: "#dbe7e2",
          cream: "#f8fafc",
          gold: "#f59e0b"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(15, 23, 42, 0.06)",
        lift: "0 18px 44px rgba(15, 23, 42, 0.14)"
      }
    }
  },
  plugins: []
};
