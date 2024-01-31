import SignIn from './sign-in'

const LandingPage = () => {
  return <SignIn />
}

// for some reason standalone builds excludes pyodide, do this so it gets included in standalone https://stackoverflow.com/questions/71422446/nextjs-force-dependency-with-outputstandalone-option
const requiredStandaloneDependencies = [
  // some required deps that have not been included in standalone
  'pyodide',
]

export const config = {
  unstable_includeFiles: requiredStandaloneDependencies.map(
    (dep) => `node_modules/${dep}/**`,
  ),
}

export default LandingPage
