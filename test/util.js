// rules: { assigned_issue: true, new_pullrequest: ['repo1', 'repo2']}
const buildCard = (rules) => {
  const m = new Map()

  // return null when there is no note (for testing cards without notes)
  if (rules === null) {
    return null
  }

  for (const key of Object.keys(rules)) {
    m.set(key, rules[key])
  }

  function buildEntry (ary) {
    const [key, value] = ary
    if (value === true) {
      return `- \`${key}\``
    } else if (Array.isArray(value)) {
      return `- \`${key}\` ${value.map(v => `**${v}**`).join(' ')}`
    } else {
      throw new Error(`BUG: value not supported: ${JSON.toString(value)}`)
    }
  }

  return `###### Automation Rules

  <!-- Documentation: https://github.com/philschatz/project-bot -->
  
  ${[...m.entries()].map(buildEntry).join('\n')}
`
}
const buildProject = (name, cardsInColumns) => {
  let id = 1
  // If number argument defined, returns new Number id; default return is new alphanumeric id
  const freshId = (number) => {
    id += 1
    return number ? id : `autoid-${id}`
  }

  return {
    name,
    id: freshId(),
    databaseId: freshId(true),
    columns: {
      nodes: cardsInColumns.map((columnCards) => {
        const id = freshId()
        const cards = columnCards.map((note) => {
          const id = freshId()
          return {
            id,
            url: `card-url-${id}`,
            note
          }
        })
        return {
          id,
          databaseId: freshId(true),
          url: `column-url-${id}`,
          firstCards: {
            totalCount: cards.length,
            nodes: cards
          },
          lastCards: {
            totalCount: cards.length,
            nodes: cards
          }
        }
      })
    }
  }
}

const getAllProjectCards = (repoName, cards) => {
  return {
    resource: {
      repository: {
        owner: {},
        projects: {
          nodes: [buildProject(`project-${repoName}`, cards)]
        }
      }
    }
  }
}

const buildOrgGraphQLResponseNew = (repoName, cards) => {
  return {
    resource: {
      repository: {
        owner: {
          projects: {
            nodes: [buildProject(`project-${repoName}`, cards)]
          }
        }
      }
    }
  }
}

const getCardAndColumnAutomationCards = (repoName, automationCards) => {
  return {
    resource: {
      projectCards: {
        nodes: [
          {
            id: 'card-id',
            url: 'card-url',
            column: {
              name: 'column-name',
              id: 'column-id'
            },
            project: buildProject(`project-${repoName}`, automationCards)
          }
        ]
      }
    }
  }
}

const findIssueId = (assigneesCount, databaseId) => {
  return {
    resource: {
      id: 'issue-id',
      assignees: {
        totalCount: assigneesCount
      },
      projectCards: {
        edges: [
          {
            node: {
              project: {
                databaseId
              }
            }
          }
        ]
      }
    }
  }
}

const getLabelId = (returnLabel) => {
  return returnLabel ? { id: 'label-id' } : null
}

module.exports = {
  buildCard,
  getCardAndColumnAutomationCards,
  getAllProjectCards,
  buildOrgGraphQLResponseNew,
  findIssueId,
  getLabelId
}
