
import MarkdownIt from 'markdown-it'
import subscript from 'markdown-it-sub'
import superscript from 'markdown-it-sup'
import deflist from 'markdown-it-deflist'
import taskLists from 'markdown-it-task-lists'
import emoji from 'markdown-it-emoji'
// import helpersMixin from '../utils/mixin'
// import * as bolt11Parser from 'light-bolt11-decoder'
// import BaseInvoice from 'components/BaseInvoice.vue'


const md = MarkdownIt({
  html: false,
  breaks: true,
  linkify: true
})
md.use(subscript)
  .use(superscript)
  .use(deflist)
  .use(taskLists)
  // .use(markdownHighlightJs)
  .use(emoji)
  .use(md => {
    // pulled from https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    // Remember old renderer, if overridden, or proxy to default renderer
    var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options)
    }

    md.core.ruler.before('normalize', 'auto-imager', state => {
      state.src = state.src.replace(/https?:[^ \n]+/g, m => {
        if (m) {
          let trimmed = m.split('?')[0]
          if (
            trimmed.endsWith('.gif') ||
            trimmed.endsWith('.png') ||
            trimmed.endsWith('.jpeg') ||
            trimmed.endsWith('.jpg') ||
            trimmed.endsWith('.svg') ||
            trimmed.endsWith('.mp4') ||
            trimmed.endsWith('.webm') ||
            trimmed.endsWith('.ogg')
          ) {
            return `![](${m})`
          }
        }

        return m
      })
    })

    md.renderer.rules.image = (tokens, idx) => {
      let src = tokens[idx].attrs[[tokens[idx].attrIndex('src')]][1]
      let trimmed = src.split('?')[0]
      // let classIndex = token.attrIndex('class')
      if (
        trimmed.endsWith('.gif') ||
        trimmed.endsWith('.png') ||
        trimmed.endsWith('.jpeg') ||
        trimmed.endsWith('.jpg') ||
        trimmed.endsWith('.svg')
      ) {
        return `<img src="${src}" crossorigin async loading='lazy' style="max-width: 90%; max-height: 50vh;">`
      } else if (
        trimmed.endsWith('.mp4') ||
        trimmed.endsWith('.webm') ||
        trimmed.endsWith('.ogg')
      ) {
        return `<video src="${src}" controls crossorigin async style="max-width: 90%; max-height: 50vh;"></video>`
      }
    }

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      // If you are sure other plugins can't add `target` - drop check below
      var token = tokens[idx]
      var aIndexTarget = token.attrIndex('target')
      var aIndexHref = token.attrIndex('href')

      // // this works but errors bc youtube needs to add header Cross-Origin-Embedder-Policy "require-corp"
      // // see issue https://issuetracker.google.com/issues/240387105
      // var ytRegex = /^https:\/\/(www.|m.)youtu(be.com|.be)\/(watch\?v=|shorts\/)(?<v>[a-zA-Z0-9_-]{11})(&t=(?<s>[0-9]+)s)?/
      // let ytMatch = token.attrs[aIndexHref][1].match(ytRegex)
      // console.log('ytMatch', ytMatch, token.attrs[aIndexHref][1])
      // if (ytMatch) {
      //   let src = `https://www.youtube.com/embed/${ytMatch.groups.v}`
      //   if (ytMatch.groups.s) src = src + `?start=${ytMatch.groups.s}`
      //   src = src + `&origin=http://localhost:8080/`
      // console.log('ytMatch', src)
      //   return `<iframe crossorigin anonymous async style="max-width: 90%; max-height: 50vh;"" src="${src}"
      //     title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
      //     </iframe>`
      // }

      var httpRegex = /^https?:\/\//

      if (httpRegex.test(token.attrs[aIndexHref][1])) {
        if (aIndexTarget < 0) {
          tokens[idx].attrPush(['target', '_blank']) // add new attribute
        } else {
          tokens[idx].attrs[aIndexTarget][1] = '_blank' // replace value of existing attr
        }
      }

      // pass token to default renderer.
      return defaultRender(tokens, idx, options, env, self)
    }

    // md.renderer.rules.code_inline = function (tokens, idx, options, env, self) {
    //   var token = tokens[idx]

    //   return `<code ${self.renderAttrs(token)}>${token.content}</code>`
    // }

    // md.renderer.rules.code_block = function (tokens, idx, options, env, self) {
    //   var token = tokens[idx]

    //   return `<code ${self.renderAttrs(token)}>${token.content}</code>`
    // }
  })

md.linkify
  .tlds(['onion', 'eth'], true)
  .add('bitcoin:', null)
  .add('lightning:', null)
  .add('http:', {
    validate(text, pos, self) {
      // copied from linkify defaultSchemas
      var tail = text.slice(pos)
      if (!self.re.http) {
        self.re.http = new RegExp(
          '^\\/\\/' +
            self.re.src_auth +
            self.re.src_host_port_strict +
            self.re.src_path,
          'i'
        )
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length
      }
      return 0
    },
    normalize(match, self) {
      if (self.__text_cache__.length < 150 || match.text < 23) {
        return
      }

      let url = new URL(match.url)
      let text = url.host
      if ((url.pathname + url.search + url.hash).length > 10) {
        let suffix = match.text.slice(-7)
        if (suffix[0] === '/') suffix = suffix.slice(1)
        text += `/…/${suffix}`
      }
      match.text = text
    }
  })
  .set({fuzzyEmail: false})


  /*
export default {
  name: 'BaseMarkdown',
  mixins: [helpersMixin],
  emits: ['expand', 'resized'],
  components: {
    BaseInvoice,
  },

  data() {
    return {
      html: '',
      invoice: null,
      // links: [],
    }
  },

  props: {
    content: {
      type: String,
      default: 'todo needs to be updated'
    },
    longForm: {
      type: Boolean,
      default: false
    },
  },

  computed: {
    parsedContent() {
      const bolt11Regex = /\b(?<i>(lnbc|LNBC)[0-9a-zA-Z]*1[0-9a-zA-Z]+)\b/g
      const replacer = (match, index) => {
        try {
          this.invoice = bolt11Parser.decode(match)
          return ''
        } catch (e) {
        console.log('invoice parsing error', e)
          return match
        }
      }
      let replacedContent = this.content.replace(bolt11Regex, replacer)
      return replacedContent
    }
  },
  }
}
*/

export const embedMedia = (content) => md.render(content)