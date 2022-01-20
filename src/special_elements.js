import React from "react";
import {Tooltip} from "./generic_elements";
import {translateIEItem, upperCaseName} from "./localization";
import {getAssetPath, getRecipePath, MOD_ID} from "./resources";

const SPECIAL_ELEMENT_HEIGHTS = {
    crafting: (e) => 'recipe' in e ? 7 : 'recipes' in e ? 7 * e['recipes'].length : 1,
    item_display: () => 4,
    image: (e) => 'images' in e ? e['images'].reduce((acc, image) => {
        let scale = 55 / image['uSize'];
        return acc + image['vSize'] * scale * 0.25;
    }, 0) : 1,
    blueprint: () => 7,
};

export function loadSpecialElement(branch, element) {
    // normal recipes
    if (element['type'] === 'crafting') {
        //single recipe
        if (element['recipe'])
            return Recipe.loadRecipe(branch, element['recipe']);
        //multiple recipes
        else if (element['recipes']) {
            let recipes = element['recipes'];
            return Promise.all(recipes.map(recipe => {
                if (Array.isArray(recipe))
                    return MultiRecipe.parseMultiRecipe(branch, recipe);
                else
                    return Recipe.loadRecipe(branch, recipe);
            }));
        }
    }
    // item displays look very silly without textures
    if (element['type'] === 'item_display') {
        return Promise.resolve(
            <div className="item_display">
                {element['item'] ? <Ingredient symbol={'Item'} value={element}/>
                    : element['items'] ? element['items'].map(item => <Ingredient symbol={'Item'} value={item}/>)
                        : null
                }
            </div>);
    }
    // images
    if (element['type'] === 'image') {
        return Promise.resolve(
            <div className="images">
                {element['images'].map((image, idx) => {
                        let scale = 55 / image['uSize'];
                        let offset = [-scale * image['uMin'], -scale * image['vMin']];
                        let style = {
                            'backgroundImage': `url(${getAssetPath(branch)}${image['location']})`,
                            'height': `${scale * image['vSize']}vmin`,
                            'backgroundSize': `${Math.round(256 / image['uSize'] * 100)}%`,
                            'backgroundPosition': `${offset[0]}vmin ${offset[1]}vmin`
                        }
                        return <div className="embedded_image" key={idx} style={style}/>
                    }
                )}
            </div>);
    }
    // blueprints are just shapeless recipes but easier
    if (element['type'] === 'blueprint') {
        //single recipe
        if (element['recipe'])
            return Blueprint.loadRecipes(branch, [element['recipe']]);
        //multiple recipes
        else if (element['recipes'])
            return Blueprint.loadRecipes(branch, element['recipes']);
    }
    return new Promise((resolve, reject) => resolve(null));
}

export function getSpecialHeight(element) {
    if (!element)
        return 0;
    let type = element['type'] || '';
    if (!(type in SPECIAL_ELEMENT_HEIGHTS))
        return 0;
    return SPECIAL_ELEMENT_HEIGHTS[type](element) || 0;
}

function ingredientTooltip(ingredient) {
    if (ingredient['base_ingredient'])
        return ingredientTooltip(ingredient['base_ingredient'])
    if (ingredient['tag'])
        return (<>
            <span>Tag:</span><br/>
            <span>{ingredient['tag']}</span>
        </>);
    else if (ingredient['item']) {
        let split = ingredient['item'].split(':');
        let domain = split.length > 1 ? split[0] : MOD_ID;
        let name = split[split.length > 1 ? 1 : 0];
        if (domain === MOD_ID) {
            name = translateIEItem(name);
            domain = 'Immersive Engineering';
        } else {
            domain = upperCaseName(domain);
            name = upperCaseName(name);
        }
        return (<>
            <span>{name}</span><br/>
            <span className="domain formatting_o">{domain}</span>
        </>);
    }
    return '';
}


class Recipe extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.data['pattern'])
            return Recipe.buildShapedRecipe(this.props.name, this.props.data);
        else if (this.props.data['ingredients'])
            return Recipe.buildShapelessRecipe(this.props.name, this.props.data);
    }

    static loadRecipeFromElement(branch, element) {
        if (typeof element === 'string')
            return Recipe.loadRecipe(branch, element);
        else if (typeof element === 'object' && 'recipe' in element)
            return Recipe.loadRecipe(branch, element['recipe']);
        return null;
    }

    static loadRecipe(branch, key) {
        return fetch(`${getRecipePath(branch)}${key}.json`)
            .then(res => res.json())
            .then(out => <Recipe name={key} key={key} data={out}/>);
    }

    static buildShapedRecipe(name, data) {
        let patternFlat = data.pattern.join('').split('');
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + data.pattern[0].length}>
                    {patternFlat.map((c, i) => <Ingredient key={i} symbol={c} value={data.key[c]}/>)}
                </div>
                <div className="arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }

    static buildShapelessRecipe(name, data) {
        let cols = data.ingredients.length === 1 ? 1 : data.ingredients.length < 5 ? 2 : 3;
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + cols}>
                    {data.ingredients.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }
}

class MultiRecipe extends React.Component {
    constructor(props) {
        super(props);
        this.state = {recipeIdx: 0};
    }

    static parseMultiRecipe(branch, array) {
        return Promise.all(array.map(o => Recipe.loadRecipeFromElement(branch, o)).filter(r => r != null))
            .then(recipes => <MultiRecipe recipes={recipes}/>);
    }

    render() {
        return <div className="multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }
}


function Ingredient(props) {
    let ingredient = props['value'];
    let present = ingredient && (ingredient['item'] || ingredient['tag'] || ingredient['base_ingredient']);
    if (!present)
        return <div className="item empty"/>;
    else {
        return <div className="item" onMouseMove={
            event => {
                let tooltip = event.currentTarget.querySelector('.tooltip');
                if (tooltip) {
                    tooltip.style.position = 'fixed';
                    tooltip.style.top = `calc(${event.clientY}px + 2vmin)`;
                    tooltip.style.left = event.clientX + 'px';
                }
            }
        }>
            <span className="symbol">{props.symbol}</span>
            {ingredient['count'] && <span className="count">{ingredient['count']}</span>}
            <Tooltip text={ingredientTooltip(ingredient)}/>
        </div>;
    }
}

class Blueprint extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            recipeIdx: 0
        };
    }

    render() {
        return <div className="blueprint multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }

    static loadRecipes(branch, recipes) {
        return Promise.all(recipes.map(
            obj => obj['item'].split(':').pop()
        ).map(
            key => fetch(`${getRecipePath(branch)}blueprint/${key}.json`)
                .then(res => res.json())
                .then(out => Blueprint.buildRecipe(key, out))
        )).then(values => <Blueprint recipes={values}/>);
    }

    static buildRecipe(name, data) {
        let cols = data.inputs.length === 1 ? 1 : data.inputs.length < 5 ? 2 : 3;
        return (
            <div className="recipe" name={name}>
                <div className="blueprint-ingredient">
                    <Ingredient symbol={'B'} value={{item: "immersiveengineering:blueprint"}}/>
                </div>
                <div className={'grid col' + cols}>
                    {data.inputs.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }
}