function ALWAYS_TRUE () { return true }
function ALWAYS_FALSE () { return false }

function validateProjectColumnMatch (logger, context, projectId, columnId) {
  const projectUrl = context.payload.project_card.project_url
  const contextProjectIdRegexMatch = projectUrl.match(/\d+$/)
  const contextProjectId = contextProjectIdRegexMatch != null && contextProjectIdRegexMatch.length === 1
    ? Number(contextProjectIdRegexMatch[0]) : null
  if (contextProjectId === null) {
    logger.error(`Unable to parse project number from Project URL "${projectUrl}"`)
    return false
  }
  const contextColumnId = context.payload.project_card.column_id

  // Make sure Project ID and Column ID are a match between context and automation card.
  return contextProjectId === projectId && contextColumnId === columnId
}

module.exports = [
  { ruleName: 'edited_issue', webhookName: 'issues.edited', ruleMatcher: ALWAYS_TRUE },
  { ruleName: 'demilestoned_issue', webhookName: 'issues.demilestoned', ruleMatcher: ALWAYS_TRUE },
  { ruleName: 'milestoned_issue', webhookName: 'issues.milestoned', ruleMatcher: ALWAYS_TRUE },
  { ruleName: 'reopened_pullrequest', webhookName: 'pull_request.reopened', ruleMatcher: ALWAYS_TRUE },
  { ruleName: 'reopened_issue', webhookName: 'issues.reopened', ruleMatcher: ALWAYS_TRUE },
  { ruleName: 'closed_issue', webhookName: 'issues.closed', ruleMatcher: ALWAYS_TRUE },
  { ruleName: 'added_reviewer', webhookName: 'pull_request.review_requested', ruleMatcher: ALWAYS_TRUE }, // See https://developer.github.com/v3/activity/events/types/#pullrequestevent to get the reviewer
  {
    createsACard: true,
    ruleName: 'new_issue',
    webhookName: 'issues.opened',
    ruleMatcher: async function (logger, context, ruleArgs) {
      if (ruleArgs.length > 0) {
        // Verify that it matches one of the repositories listed
        const repoNames = ruleArgs
        return repoNames.indexOf(context.payload.repository.name) >= 0
      } else {
        return true
      }
    }
  },
  {
    createsACard: true,
    ruleName: 'new_pullrequest',
    webhookName: 'pull_request.opened',
    ruleMatcher: async function (logger, context, ruleArgs) {
      if (ruleArgs.length > 0) {
        // Verify that it matches one of the repositories listed
        const repoNames = ruleArgs

        return repoNames.indexOf(context.payload.repository.name) >= 0
      } else {
        return true
      }
    }
  },
  {
    ruleName: 'merged_pullrequest',
    webhookName: 'pull_request.closed',
    ruleMatcher: async function (logger, context, ruleArgs) {
      // see https://developer.github.com/v3/activity/events/types/#pullrequestevent
      return !!context.payload.pull_request.merged
    }
  },
  {
    ruleName: 'closed_pullrequest',
    webhookName: 'pull_request.closed',
    ruleMatcher: async function (logger, context, ruleArgs) {
      // see https://developer.github.com/v3/activity/events/types/#pullrequestevent
      return !context.payload.pull_request.merged
    }
  },
  {
    ruleName: 'assigned_to_issue',
    webhookName: 'issues.assigned',
    ruleMatcher: async function (logger, context, ruleArgs) {
      if (ruleArgs[0] !== true) {
        return context.payload.assignee.login === ruleArgs[0]
      } else {
        logger.error(`assigned_to.issue requires a username but it is missing`)
      }
    }
  },
  {
    ruleName: 'assigned_issue',
    webhookName: 'issues.assigned',
    ruleMatcher: async function (logger, context, ruleArgs) {
      return context.payload.issue.assignees.length === 1
    }
  },
  {
    ruleName: 'unassigned_issue',
    webhookName: 'issues.unassigned',
    ruleMatcher: async function (logger, context, ruleArgs) {
      return context.payload.issue.assignees.length === 0
    }
  },
  {
    ruleName: 'assigned_pullrequest',
    webhookName: 'pull_request.assigned',
    ruleMatcher: async function (logger, context, ruleArgs) {
      return context.payload.pull_request.assignees.length === 1
    }
  },
  {
    ruleName: 'unassigned_pullrequest',
    webhookName: 'pull_request.unassigned',
    ruleMatcher: async function (logger, context, ruleArgs) {
      return context.payload.pull_request.assignees.length === 0
    }
  },
  {
    ruleName: 'added_label',
    webhookName: 'issues.labeled',
    ruleMatcher: async function (logger, context, ruleArgs) {
      // labels may be defined by a label or an id (for more persistence)
      return context.payload.label.name === ruleArgs[0] || context.payload.label.id === ruleArgs[0]
    }
  },
  {
    ruleName: 'added_label',
    webhookName: 'pull_request.labeled',
    ruleMatcher: async function (logger, context, ruleArgs) {
      // labels may be defined by a label or an id (for more persistence)
      return context.payload.label.name === ruleArgs[0] || context.payload.label.id === ruleArgs[0]
    }
  },
  {
    ruleName: 'removed_label',
    webhookName: 'issues.unlabeled',
    ruleMatcher: async function (logger, context, ruleArgs) {
      return context.payload.label.name === ruleArgs[0] || context.payload.label.id === ruleArgs[0]
    }
  },
  {
    ruleName: 'removed_label',
    webhookName: 'pull_request.unlabeled',
    ruleMatcher: async function (logger, context, ruleArgs) {
      return context.payload.label.name === ruleArgs[0] || context.payload.label.id === ruleArgs[0]
    }
  },
  {
    ruleName: 'accepted_pullrequest',
    webhookName: 'pull_request_review.submitted',
    ruleMatcher: async function (logger, context, ruleArgs) {
      // See https://developer.github.com/v3/activity/events/types/#pullrequestreviewevent
      // Check if there are any Pending or Rejected reviews and ensure there is at least one Accepted one
      const issue = context.issue()
      const { data: reviews } = await context.github.pulls.listReviews({ owner: issue.owner, repo: issue.repo, pull_number: issue.number })
      // Check that there is at least one Accepted
      const hasAccepted = reviews.filter((review) => review.state === 'APPROVED').length >= 1
      const hasRejections = reviews.filter((review) => review.state === 'REQUEST_CHANGES').length >= 1
      const hasPending = reviews.filter((review) => review.state === 'PENDING').length >= 1
      if (hasAccepted && !hasRejections && !hasPending) {
        return true
      } else {
        return false
      }
    }
  },
  {
    modifyIssue: true,
    ruleName: 'add_label',
    webhookName: 'project_card.moved',
    ruleMatcher: ALWAYS_FALSE,
    ruleAction: async function (logger, context, issueUrl, projectId, columnId, ruleArgs) {
      // Currently, this rule will only apply the first label name provided in ruleArgs
      if (ruleArgs.length === 0) {
        logger.error(`No label names provided for "add_label" rule`)
        return false
      }

      // Make sure Project ID and Column ID are a match between context and automation card.
      if (!validateProjectColumnMatch(logger, context, projectId, columnId)) {
        return false
      }

      const graphResourceResult = await context.github.graphql(`
        query FindIssueID($issueUrl: URI!) {
          resource(url: $issueUrl) {
            ... on Issue {
              id
              repository {
                name
                owner {
                  login
                }
              }
            }
          }
        }
      `, { issueUrl: issueUrl })
      const { resource } = graphResourceResult
      const issueId = resource.id
      const repoName = resource.repository.name
      const repoOwner = resource.repository.owner.login

      const graphLabelResult = await context.github.graphql(`
        query FindLabelID(
          $labelName: String!,
          $repoName: String!,
          $repoOwner: String!
        ) {
          repository(owner:$repoOwner, name:$repoName) {
            label(name:$labelName) {
              id
            }
          }
        }
      `, { labelName: ruleArgs[0], repoName: repoName, repoOwner: repoOwner })
      const { repository } = graphLabelResult

      // Check for label id. Log error and don't continue command if no label id
      if (repository.label == null || repository.label.id === undefined) {
        logger.error(`No label id returned from query`)
        return false
      }
      const labelId = repository.label.id

      logger.info(`Adding Label ${labelId} to Issue "${issueId}" because of "add_label", Issue URL "${issueUrl}", and value: "${ruleArgs}"`)
      await context.github.graphql(`
        mutation AddLabelToCard($issueId: ID!, $labelId: ID!) {
          addLabelsToLabelable(input:{labelIds:[$labelId],labelableId:$issueId}) {
            labelable {
              labels(first:10) {
                edges {
                  node {
                    name
                  }
                }
              }
              ... on Issue {
                url
              }
              ... on PullRequest {
                url
              }
            }
          }
        }
      `, { issueId: issueId, labelId: labelId })
      return true
    }
  },
  {
    modifyIssue: true,
    ruleName: 'assign_issue_on_branch_create',
    webhookName: 'create',
    ruleMatcher: ALWAYS_FALSE,
    ruleAction: async function (logger, context, issueUrl, projectId, columnId, ruleArgs) {
      const branch = context.payload.ref
      const senderId = context.payload.sender.node_id

      const graphResourceResult = await context.github.graphql(`
        query FindIssueID($issueUrl: URI!) {
          resource(url: $issueUrl) {
            ... on Issue {
              id
              assignees {
                totalCount
              }
              projectCards {
                edges {
                  node {
                    project {
                      databaseId
                    }
                  }
                }
              }
            }
          }
        }
      `, { issueUrl: issueUrl })
      const { resource } = graphResourceResult
      const issueId = resource.id
      const assignees = resource.assignees.totalCount
      const issueProjectCards = resource.projectCards.edges

      if (assignees !== 0) {
        logger.debug(`Issue "${issueId}" already has assignee(s)`)
        return false
      }
      for (const { node } of issueProjectCards) {
        // Make sure there is a matching Project ID between Issue and automation card.
        if (node.project.databaseId === projectId) {
          logger.info(`Assigning User ${senderId} to Issue "${issueId}" because of "assign_issue_on_branch_create", branch "${branch}", and Issue URL "${issueUrl}"`)
          await context.github.graphql(`
            mutation AssignIssue($issueId: ID!, $userId: ID!) {
              addAssigneesToAssignable(input:{assignableId:$issueId,assigneeIds:[$userId]}) {
                assignable {
                  assignees {
                    totalCount
                  }
                }
              }
            }
          `, { issueId: issueId, userId: senderId })
          return true
        }
      }
      logger.debug(`Looped through all Project Cards of Issue "${issueId}" and no matching Project "${projectId}" was found. Odd.`)
      return false
    }
  },
  {
    modifyIssue: true,
    ruleName: 'close_issue',
    webhookName: 'project_card.moved',
    ruleMatcher: ALWAYS_FALSE,
    ruleAction: async function (logger, context, issueUrl, projectId, columnId, ruleArgs) {
      // Make sure Project ID and Column ID are a match between context and automation card.
      if (!validateProjectColumnMatch(logger, context, projectId, columnId)) {
        return false
      }


    }
  }
]
