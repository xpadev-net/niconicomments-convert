export default {
    "{src,electron}/**/*.{ts,tsx,json,scss,css}": [()=>"npm run format",()=>"npm run eslint:fix",()=>"npm run check-types"],
};