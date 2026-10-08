import { Link } from 'react-router-dom'
import { LegalLayout } from '../components/marketing/LegalLayout'
import { githubUrl } from '../components/marketing/links'
import { usePageTitle } from '../components/marketing/usePageTitle'

export default function Terms() {
  usePageTitle('Terms')
  const repo = githubUrl()
  return (
    <LegalLayout
      title="Terms"
      updated="2026-10-07"
      lead={
        <p>
          The terms for using the hosted instance of Squash, an open-source project run by its
          maintainer. They are short because the promise is small: it is free, and it comes with no
          guarantees.
        </p>
      }
      sections={[
        {
          id: 'the-service',
          title: 'The service',
          body: (
            <>
              <p>
                The hosted instance is offered free of charge, as is, by the maintainer of this
                open-source project. There is no paid tier, no service level agreement and no uptime
                guarantee. Features can change or be removed between releases, which are listed in
                the <Link to="/changelog">changelog</Link>.
              </p>
              <p>
                If you need guarantees, run your own copy: see{' '}
                <Link to="/docs/self-host">Self-host</Link>.
              </p>
            </>
          ),
        },
        {
          id: 'your-content',
          title: 'Your content',
          body: (
            <p>
              What you put into Squash (bugs, screenshots, comments) stays yours. You let the
              service store it and show it to the members of the workspace you put it in, which is
              what it is for. Only upload what you are allowed to share with those members.
            </p>
          ),
        },
        {
          id: 'fair-use',
          title: 'Fair use',
          body: (
            <>
              <p>Don’t use the hosted instance to:</p>
              <ul>
                <li>break the law or store content you have no right to share;</li>
                <li>get into workspaces or data that are not yours;</li>
                <li>
                  load-test it, flood it, or work around its limits (10 members per workspace, 5
                  owned workspaces, 10 images per bug, 30 bugs and 30 comments a minute).
                </li>
              </ul>
              <p>
                Accounts or workspaces that do may be removed. Found a security problem? Report it
                privately as described in the <Link to="/docs/security">security model</Link>.
              </p>
            </>
          ),
        },
        {
          id: 'your-account',
          title: 'Your account',
          body: (
            <p>
              Keep access to your email or Google account secure: it is how you sign in. Invite
              links let anyone who has them join a workspace, so share them only with people you
              mean to invite; an owner can regenerate the link at any time. You can export your bugs
              and delete your account from the app whenever you like.
            </p>
          ),
        },
        {
          id: 'no-warranty',
          title: 'No warranty',
          body: (
            <p>
              Squash is provided “as is”, without warranty of any kind, in the same terms as its{' '}
              <a href={`${repo}/blob/main/LICENSE`}>MIT license</a>. To the extent the law allows,
              the maintainer is not liable for any loss arising from its use, including lost data.
              Keep your own copy of anything you cannot afford to lose; the CSV and Markdown exports
              exist for that.
            </p>
          ),
        },
        {
          id: 'the-code',
          title: 'The code',
          body: (
            <p>
              These terms cover the hosted service. The software itself is licensed separately under
              the MIT license, which lets you use, copy, modify and distribute it.
            </p>
          ),
        },
        {
          id: 'changes',
          title: 'Changes and questions',
          body: (
            <p>
              These terms change in the open repository, and the date above changes with them.
              Questions go to an issue on <a href={`${repo}/issues`}>GitHub</a>. See also the{' '}
              <Link to="/privacy">privacy notice</Link>.
            </p>
          ),
        },
      ]}
    />
  )
}
