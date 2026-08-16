/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#FFF4ED",
          100: "#FFE4D3",
          300: "#FFB088",
          500: "#E8613C",
          600: "#D14A27",
          700: "#AC3820",
          900: "#6E2314",
        },
        accent: {
          50: "#ECFDF9",
          100: "#D0FAF0",
          300: "#7EE8D6",
          500: "#0F9B8E",
          600: "#0C7C72",
          700: "#0A6259",
          900: "#073F3A",
        },
        neutral: {
          50: "#FBF9F7",
          100: "#F3EFEA",
          200: "#E4DED5",
          300: "#CFC5B8",
          500: "#8A7E6E",
          700: "#4F473C",
          800: "#332D25",
          900: "#211D18",
        },
      },
    },
  },
  plugins: [],
};
