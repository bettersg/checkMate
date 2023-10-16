const withMT = require("@material-tailwind/react/utils/withMT");
 
module.exports = withMT({
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        sidebar: "1fr auto", //for sidebar layout
        "sidebar-collapsed": "0.25fr auto", //for collapsed sidebar layout
      },
    },
  },
  plugins: [],
});

