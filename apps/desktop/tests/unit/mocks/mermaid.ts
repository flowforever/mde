import { vi } from 'vitest'

export const mockMermaid = {
  initialize: vi.fn(),
  render: vi.fn().mockResolvedValue({
    svg: '<svg role="img"><text>Rendered flowchart</text></svg>'
  })
}

export default mockMermaid
