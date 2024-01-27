import { extendTheme } from '@chakra-ui/react'
import { theme as ogpDsTheme } from '@opengovsg/design-system-react'
import { shadows } from './foundations/shadows'
import { layerStyles } from './layerStyles'
import { components } from './components'
import { textStyles } from './foundations/textStyles'
import { withProse } from '@nikolovlazar/chakra-ui-prose'

export const theme = extendTheme(
  ogpDsTheme,
  {
    shadows,
    components: {
      ...ogpDsTheme.components,
      ...components,
    },
    textStyles,
    layerStyles,
  },
  withProse(),
)
