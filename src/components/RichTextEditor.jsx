import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Themed WYSIWYG editor (bold/italic/underline, headings, ordered & bullet
// lists) used for long admin-authored copy — currently just the market
// terms & conditions, which can run long enough to need real formatting
// instead of a plain textarea. See index.css for the `.rich-editor` theme
// overrides that make Quill's toolbar/body match the rest of the admin UI.
const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['clean'],
];

export default function RichTextEditor({ value, onChange, minHeight = 220 }) {
  return (
    <div className="rich-editor" style={{ '--rich-editor-min-height': `${minHeight}px` }}>
      <ReactQuill theme="snow" value={value} onChange={onChange} modules={{ toolbar: TOOLBAR }} />
    </div>
  );
}
