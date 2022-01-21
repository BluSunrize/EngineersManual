import React from "react";
import reactStringReplace from "react-string-replace";
import {
    Anchor,
    ConfigBool,
    ConfigInt,
    ConfigIntArray,
    Formatting,
    KeyBind,
    ManualLink,
    PageBreak
} from "./generic_elements";
import {reactSetStateWrapper} from "./resources";
import {verifyEntryExists} from "./App";

const re_anchor = /<&(\w+)>/g;
const re_link = /<link;(\w+);([^;]*?)(?:;([^>]*))?>/g;
const re_keybind = /<keybind;([\w.]+)>/g;
const re_formatting = /§([^r])(.+?)§r/g;

const re_config_int = /<config;i;([^;>]+)>/g
const re_config_bool = /<config;b;([^;>]+);([^;>]+);([^;>]*)>/g
const re_config_int_array = /<config;iA;([^;>]+)(?:;([^;>]*))?>/g

function replaceJSX(input, pattern, fn) {
    if (input instanceof Array)
        for (let i in input)
            input[i] = replaceJSX(input[i], pattern, fn)
    else if (typeof input === "string")
        for (let match of input.matchAll(pattern)) {
            let rep = fn(...match);
            input = reactStringReplace(input, match[0], () => rep);
        }
    return input;
}

function isReactElement(element, ...types) {
    if (!React.isValidElement(element))
        return false;
    if (types.length > 0)
        return types.map(t => t.name).includes(element.type.name);
    return true;
}

const LINES_PER_PAGE = 17;
const CHARS_PER_LINE = 30;
const CHARS_PER_PAGE = LINES_PER_PAGE * CHARS_PER_LINE;

export class ManualEntry extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: 0,
            pages: [],
            loaded: false
        };

        const loadEntry = async () => {
            let pages = [];

            let formatted = this.handleReplacements(this.props.text, this.props.data);
            if (typeof formatted === 'string')
                // rare case of a pure text entry
                formatted = [formatted]
            else
                // if we have a nesting greater than 100, we did something wrong
                formatted = formatted.flat(100).filter(e => e !== '');

            // add a start anchor, if missing
            if (!isReactElement(formatted[0], Anchor))
                formatted.unshift(Anchor.make('start', this.props.branch, this.props.data));

            // split at the pagebreaks
            let last = 0;
            let length = 0;
            for (let i = 0; i < formatted.length; i++) {
                let isBreak = isReactElement(formatted[i], PageBreak, Anchor);
                let hasSpliced = false;
                if (!isBreak) {
                    // check if we can fit the whole piece
                    let lines = null;
                    let lengthL = CHARS_PER_LINE;
                    // if it's a string, split it into lines
                    if (typeof formatted[i] === 'string') {
                        lines = formatted[i].match(/.{1,30}(\s|$)/g);
                        lengthL = formatted[i].length;
                        //lengthL = lines.length * CHARS_PER_LINE;
                        //formatted[i].length < 3 ? 0 : lines.length;
                    } else if (isReactElement(formatted[i], Formatting, ConfigBool, ManualLink)) {
                        lengthL = formatted[i].props.length;
                    } else if (isReactElement(formatted[i], <br/>)) {
                        lengthL = CHARS_PER_LINE;
                    } else if (isReactElement(formatted[i], ConfigIntArray, ConfigInt)) {
                        lengthL = 7;
                    }

                    //CHARS_PER_PAGE
                    if (length + lengthL > CHARS_PER_PAGE) {
                        // if it's multiple lines, try partial fit
                        if (lines && lines.length > 1) {
                            let currentLineCount = Math.round(length / CHARS_PER_LINE);
                            let willFit = lines.slice(0, LINES_PER_PAGE - currentLineCount).join('');
                            let wontFit = lines.slice(LINES_PER_PAGE - currentLineCount).join('');
                            formatted.splice(i, 1, willFit, wontFit);
                            hasSpliced = true;
                            i++;
                            lengthL = willFit.length;
                        }
                        isBreak = true;
                    }
                    length += lengthL;
                }


                if (isBreak) {
                    pages.push(formatted.slice(last, i))
                    if (isReactElement(formatted[i], PageBreak))
                        last = i + 1
                    else
                        last = i;
                    length = 0;
                    if (isReactElement(formatted[i], Anchor)) {
                        length = formatted[i].props.height * CHARS_PER_LINE;
                    }

                    if (hasSpliced)
                        i--;
                }
            }
            // add the rest
            pages.push(formatted.slice(last, formatted.length))

            // filter out empties, wrap in divs
            pages = pages
                .filter(p => p.length > 0 && p.some(e => !isReactElement(e, <br/>)))
                .map(p => <div className="pagecontent">{p}</div>);

            reactSetStateWrapper(this, {pages: pages});
        }
        loadEntry();
    }

    handleReplacements(input, data) {
        // remove pagebreaks (and trailing newlines)
        input = replaceJSX(input, /<np>(\n)*/g, () => <PageBreak/>);

        // replace all links
        input = replaceJSX(input, re_link, (match, link, text, anchor) => {
            // local reference
            if (link === 'this')
                link = ''
            else
                verifyEntryExists(this.props.branch, this.props.lang, link);
            return <ManualLink key={link + '?' + anchor} link={link} anchor={anchor} length={text.length}
                               text={this.handleReplacements(text)}/>;
        });

        // replace all instances of formatting with nested spans
        input = replaceJSX(input, re_formatting, (match, format, text) => {
            return <Formatting format={format} length={text.length} text={this.handleReplacements(text + '§r')}/>
        });

        // replace all integer config values
        input = replaceJSX(input, re_config_int, (match, cfg) => <ConfigInt cfg={cfg}/>);

        // replace all boolean config values
        input = replaceJSX(input, re_config_bool, (match, cfg, on, off) =>
            <ConfigBool cfg={cfg}
                        text={[this.handleReplacements(on), this.handleReplacements(off)]}
                        length={Math.max(on.length, off.length)}
            />);

        // replace all integer config values
        input = replaceJSX(input, re_config_int_array, (match, cfg) => <ConfigIntArray cfg={cfg}/>);

        // mark the anchors as pagebreaks
        input = replaceJSX(input, re_anchor, (match, anchor) => Anchor.make(anchor, this.props.branch, data));

        // replace all keybinds
        input = replaceJSX(input, re_keybind, (match, bind) => <KeyBind keybind={bind}/>);

        // replace all linebreaks
        input = replaceJSX(input, /(\n)|(\\n)|(<br>)/g, () => <br/>);

        // remove leftover format resetters
        input = replaceJSX(input, '§r', () => null);

        return input;
    }


    componentDidMount() {
        this.setState({
            loaded: true
        });
    }

    handleTouchStart(event) {
        this.touchStart = event.changedTouches[0].clientX;
    }

    handleTouchEnd(event) {
        if (event.target.clientWidth > 0) {
            const touchEnd = event.changedTouches[0].clientX;
            const dist = (this.touchStart - touchEnd) / event.target.clientWidth;
            if (Math.abs(dist) > 0.2) {
                if (dist > 0 && this.state.page < this.state.pages.length - 1)
                    this.setPage(this.state.page + 1);
                if (dist < 0 && this.state.page > 0)
                    this.setPage(this.state.page - 1);
            }
        }
    }

    setPage(page) {
        this.setState({
            page: page
        })
    }

    render() {
        return this.state.loaded ? (
            <div onTouchStart={event => this.handleTouchStart(event)}
                 onTouchEnd={event => this.handleTouchEnd(event)}>
                <h2>{this.props.title}</h2>
                <h3>{this.props.subtitle}</h3>
                <div key={this.props.text} className="page">
                    {this.state.pages[this.state.page]}
                </div>
                <footer>
                    <button
                        className={"page_prev" + (this.state.page > 0 ? '' : ' off')}
                        onClick={() => this.setPage(this.state.page - 1)}/>
                    <span className="page-number">{this.state.page + 1}</span>
                    <button
                        className={"page_next" + (this.state.page < this.state.pages.length - 1 ? '' : ' off')}
                        onClick={() => this.setPage(this.state.page + 1)}/>
                </footer>
            </div>
        ) : <span>Page is loading, please wait</span>;
    }

}