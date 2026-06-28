import withMT from "@material-tailwind/react/utils/withMT";

/** @type {import('tailwindcss').Config} */
export default withMT({
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fuel: {
          ink: "#17201b",
          green: "#0b6b4b",
          deep: "#063f32",
          lime: "#d7f75b",
          mist: "#eef7f1",
          line: "#d8e4dc",
          cream: "#fafcf8",
          gold: "#f2c94c"
        }
      },
      boxShadow: {
        soft: "0 14px 40px rgba(23, 32, 27, 0.08)",
        lift: "0 18px 50px rgba(6, 63, 50, 0.14)"
      }
    }
  },
  plugins: []
});
