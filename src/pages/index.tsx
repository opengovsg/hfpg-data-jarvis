import SignIn from './sign-in'

const LandingPage = () => {
  return <SignIn />
}

// for some reason standalone builds excludes pyodide, do this so it gets included in standalone https://stackoverflow.com/questions/71422446/nextjs-force-dependency-with-outputstandalone-option
// https://github.com/vercel/next.js/discussions/35792
export const config = {
  unstable_includeFiles: ['node_modules/pyodide/**/*.*'],
}
export default LandingPage
