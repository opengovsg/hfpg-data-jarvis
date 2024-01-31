import { loadPyodide } from 'pyodide'

export const PyodideService = async () => {
  const pyodide = await loadPyodide()
  await pyodide.loadPackage('micropip')
  const micropip = pyodide.pyimport('micropip')
  await micropip.install('matplotlib')
  return pyodide
}
