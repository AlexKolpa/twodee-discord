module.exports = {
	"extends" : [
		"airbnb-base"
	],
	"parser" : "babel-eslint",
	"env" : {
		"node" : true
	},
	"rules" : {
		"no-tabs" : 0,
		//copied from airbnb styleguide, but changed 2 -> tab
		"indent" : ['error', 'tab', {
			SwitchCase : 1,
			VariableDeclarator : 1,
			outerIIFEBody : 1,
			FunctionDeclaration : {
				parameters : 1,
				body : 1
			},
			FunctionExpression : {
				parameters : 1,
				body : 1
			}
		}],
		"max-len": ["error", {"code": 120, "tabWidth": 2, "ignoreUrls": true}],
	}
};
